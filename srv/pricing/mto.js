const cds = require("@sap/cds");
const { SELECT, INSERT, UPDATE } = cds.ql;
const { Models, PricingResults, MTOConfigurations, MTOConfigurationParts, Parts } = cds.entities("vehicle.db");
 
const TOLERANCE = 0.01;    
const MAX_ITERATIONS = 100;
 
const round2 = n => Number(Number(n).toFixed(2));
 
/* ------------------------------------------------------------------
   NSP -> Ex-Showroom, built ONLY from the stored (approved) MTS PricingResult.
   Fixed amounts (helmet, transportation, other expenses, helmet margin) and the
   two rates (dealer margin %, GST %) are taken from the saved MTS row, so MTO
   always uses exactly the same basis the approved MTS price was built on.
------------------------------------------------------------------ */
function buildExShowroomFn(mts) {
    const helmet = Number(mts.helmet || 0);
    const transportation = Number(mts.transportation || 0);
    const otherExpenses = Number(mts.otherExpenses || 0);
    const helmetMargin = Number(mts.helmetMargin || 0);
 
    const dealerCost = Number(mts.dealerCost || 0);
    const basicPrice = Number(mts.basicPrice || 0);
    if (dealerCost <= 0 || basicPrice <= 0) return null;   // MTS row has no price breakup
 
    const dealerMarginRate = Number(mts.dealerMargin || 0) / dealerCost;   // e.g. 0.06
    const gstRate = Number(mts.gstAmount || 0) / basicPrice;               // e.g. 0.28
 
    return nsp => {
        const cost = nsp + helmet + transportation;
        const basic = cost + otherExpenses + cost * dealerMarginRate + helmetMargin;
        return basic * (1 + gstRate);
    };
}
 
/* ------------------------------------------------------------------
   Ex-Showroom -> On-Road
   On-Road = Ex-Showroom + RTO + RTO With Bill + Total Insurance
   Rates are taken from the approved MTS PricingResult (same region/slab).
   NOTE: if the new Ex-Showroom crosses into another RTO/insurance price
   slab, this function must be extended to re-read RTOMasters/RTOExpense.
------------------------------------------------------------------ */
function buildOnRoadFn(mts) {
    const rtoPercent = Number(mts.rtoPercent || 0);
    const rtoWithBill = Number(mts.rtoWithBill || 0);
    const insuranceRate = Number(mts.insuranceRate || 0);
    const tpaPa = Number(mts.tpaPa || 0);
 
    const insBase = Number(mts.insuranceAmount || 0) + tpaPa;
    const insGstRate = insBase > 0 ? Number(mts.insuranceGst || 0) / insBase : 0;
 
    return exShowroom => {
        const rto = exShowroom * rtoPercent;
        const insurance = exShowroom * insuranceRate;
        const totalInsurance = (insurance + tpaPa) * (1 + insGstRate);
        return exShowroom + rto + rtoWithBill + totalInsurance;
    };
}
 
/* ------------------------------------------------------------------
   Goal seek on NSP (spec 5.2 steps 5 and 6)
   Finds the NSP for which fn(NSP) equals the target (within TOLERANCE).
   Bisection is used instead of Rs 1 steps: same result, far fewer iterations.
------------------------------------------------------------------ */
function goalSeekNSP(target, fn) {
    let low = 0;
    let high = Math.max(target, 1);
 
    if (fn(low) > target) return null;                    // target below the minimum possible
    while (fn(high) < target && high < 1e9) high *= 2;    // widen upper bound
    if (fn(high) < target) return null;
 
    let mid = 0;
    let iterations = 0;
    while (iterations < MAX_ITERATIONS) {
        iterations++;
        mid = (low + high) / 2;
        const value = fn(mid);
        if (Math.abs(value - target) <= TOLERANCE) {
            return { nsp: mid, iterations };
        }
        if (value < target) low = mid; else high = mid;
    }
    return null;   // did not converge
}
 
async function calculateMTO(req) {
    const tx = cds.tx(req);
    const items = req.data.items || [];
    const results = [];
 
    if (items.length === 0) return req.reject(400, "Please provide at least one MTO item");
 
    for (const item of items) {
        const { modelCode, regionCode, engineType, orderType, validFrom } = item;   // parts are NOT sent: they come from the MTO configuration
 
        console.log("\n========================================");
        console.log("MTO CALCULATION START");
        console.log("MTO Model :", modelCode);
        console.log("Region :", regionCode);
        console.log("Engine :", engineType);
        console.log("Order Type :", orderType);
        console.log("Date :", validFrom);
 
        if (!modelCode) return req.reject(400, "modelCode is required");
        if (!regionCode) return req.reject(400, "regionCode is required");
        if (!validFrom) return req.reject(400, "validFrom is required");
        if (orderType !== "MTO") return req.reject(400, "orderType must be MTO");
 
        // ---------------------------------------------------------------
        // Spec 1: MTO display model is linked to a Reference MTS model
        console.log("\nSTEP 1: FIND MTO CONFIGURATION");
 
        const configurations = await tx.run(
            SELECT.from(MTOConfigurations).where({ mtoModelCode: modelCode })
        );
 
        if (!configurations || configurations.length === 0)
            return req.reject(404, `MTO Configuration not found for MTO model ${modelCode}`);
 
        const selectedDate = new Date(validFrom);
        const validConfigurations = configurations
            .filter(c => c.validFrom && new Date(c.validFrom) <= selectedDate)
            .sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom));
 
        if (validConfigurations.length === 0)
            return req.reject(404, `No valid MTO Configuration found for ${modelCode} on ${validFrom}`);
 
        const mtoConfiguration = validConfigurations[0];
        const mtoModelCode = mtoConfiguration.mtoModelCode;
        const referenceMTSModel = mtoConfiguration.referenceMTSModel_modelCode;
 
        console.log("MTO Model Code :", mtoModelCode);
        console.log("Valid From :", mtoConfiguration.validFrom);
        console.log("Reference MTS :", referenceMTSModel);
 
        // ---------------------------------------------------------------
        console.log("\nSTEP 2: FIND MTS MODEL");
 
        const mtsModel = await tx.run(SELECT.one.from(Models).where({ modelCode: referenceMTSModel }));
        if (!mtsModel) return req.reject(404, `MTS Model ${referenceMTSModel} not found`);
 
        console.log("MTS Model found :", mtsModel.modelCode);
 
        if (engineType && mtsModel.engineType !== engineType)
            return req.reject(400, `Engine type ${engineType} does not match MTS Model ${referenceMTSModel}`);
 
        // ---------------------------------------------------------------
        // Spec 2: only an APPROVED MTS price line may be used as the base
        console.log("\nSTEP 3: CHECK MTS PRICING RESULT");
 
        const mtsPricingResult = await tx.run(
            SELECT.one.from(PricingResults).where({
                model_modelCode: referenceMTSModel,
                region_regionCode: regionCode,
                orderType: "MTS",
                status : "APPROVED"
            })
        );
 
        if (!mtsPricingResult)
            return req.reject(404, `MTS PricingResult not found for ${referenceMTSModel} / ${regionCode}`);
 
        if (mtsPricingResult.status !== "APPROVED")
            return req.reject(400, `MTS PricingResult for ${referenceMTSModel} / ${regionCode} is not APPROVED (status: ${mtsPricingResult.status})`);
 
        console.log("MTS PricingResult found");
        console.log("Status :", mtsPricingResult.status);
        console.log("Actual NSP :", mtsPricingResult.actualNSP);
        console.log("Ex-Showroom :", mtsPricingResult.exShowroomPrice);
        console.log("On-Road :", mtsPricingResult.onRoadPrice);
 
        const mtsNSP = Number(mtsPricingResult.actualNSP || 0);
        const mtsExShowroom = Number(mtsPricingResult.exShowroomPrice || 0);
        const mtsOnRoad = Number(mtsPricingResult.onRoadPrice || 0);
 
        // ---------------------------------------------------------------
        // Spec 3: classify each fitted part into Ex-Showroom / On-Road bucket
        console.log("\nSTEP 4: FIND SELECTED PARTS");
 
        let miyExShowroomTotal = 0;     // MIY Cost of "Ex-Showroom" parts
        let miyOnRoadTotal = 0;         // MIY Cost of "On-Road" parts
        let incrementDealer = 0;        // Spec 7: total MIY Markup absorbed by dealer margin
        const partBreakup = [];         // Spec 8: part-wise breakup
        let runningExShowroom = mtsExShowroom;
 
        // Parts come from the MTO configuration (MTOConfigurationParts), not from the request
        const configParts = (await tx.run(
            SELECT.from(MTOConfigurationParts).where({ configuration_mtoModelCode: mtoModelCode })
        )).sort((a, b) => Number(a.partNo) - Number(b.partNo));
 
        if (configParts.length === 0)
            return req.reject(422, `No parts are configured for MTO model ${mtoModelCode}`);
 
        console.log(`Parts configured for ${mtoModelCode} :`, configParts.length);
 
        for (const configPart of configParts) {
            const partCode = configPart.part_partCode;
            const quantity = Number(configPart.quantity ?? 1);
 
            if (!partCode) return req.reject(400, `Part missing in MTO configuration ${mtoModelCode} (partNo ${configPart.partNo})`);
            if (!Number.isFinite(quantity) || quantity <= 0)
                return req.reject(400, `Invalid quantity for ${partCode} in MTO configuration ${mtoModelCode}`);
 
            const part = await tx.run(SELECT.one.from(Parts).where({ partCode: partCode }));
            if (!part) return req.reject(404, `Part ${partCode} not found`);
 
            const miyCost = Number(part.miyCost || 0) * quantity;
            const miyMarkup = Number(part.miyMarkup || 0) * quantity;
 
            const before = runningExShowroom;
            if (part.priceIndicator === "EXSHOWROOM") {
                miyExShowroomTotal += miyCost;
                runningExShowroom += miyCost;
            } else if (part.priceIndicator === "ONROAD") {
                miyOnRoadTotal += miyCost;
            } else {
                console.log("Warning: Unknown priceIndicator :", part.priceIndicator);
            }
            incrementDealer += miyMarkup;
 
            partBreakup.push({
                partCode: partCode,
                description: part.description,
                quantity: quantity,
                priceIndicator: part.priceIndicator,
                miyCost: round2(miyCost),
                miyMarkup: round2(miyMarkup),
                exShowroomBefore: round2(before),
                exShowroomAfter: round2(runningExShowroom)
            });
 
            console.log(`PART ${partCode} | ${part.description} | qty ${quantity} | cost ${miyCost} | markup ${miyMarkup} | ${part.priceIndicator}`);
        }
 
        console.log("MIY Ex-Showroom cost :", miyExShowroomTotal);
        console.log("MIY On-Road cost :", miyOnRoadTotal);
        console.log("Increment Dealer (markup) :", incrementDealer);
 
        // ---------------------------------------------------------------
        console.log("\nSTEP 5: GOAL SEEK");
 
        // NSP -> Ex-Showroom, taken from the stored MTS PricingResult
        const exFn = buildExShowroomFn(mtsPricingResult);
        if (!exFn)
            return req.reject(422, `MTS PricingResult for ${referenceMTSModel} / ${regionCode} has no price breakup (dealerCost / basicPrice)`);
 
        // sanity check: this must reproduce the stored MTS Ex-Showroom
        const check = exFn(mtsNSP);
        if (Math.abs(check - mtsExShowroom) > 1)
            console.log(`Warning: recalculated MTS Ex-Showroom ${check.toFixed(2)} differs from stored ${mtsExShowroom}`);
 
        // Spec 4: Expected Ex-Showroom target = MTS Ex-Showroom + MIY cost of Ex-Showroom parts
        const exShowroomTarget = mtsExShowroom + miyExShowroomTotal;
 
        // Spec 5: goal seek NSP so the full calculation reproduces the Ex-Showroom target
        const exSeek = goalSeekNSP(exShowroomTarget, exFn);
        if (!exSeek)
            return req.reject(422, `Could not solve NSP for Ex-Showroom target ${exShowroomTarget}`);
 
        let solvedNSP = exSeek.nsp;
        let iterations = exSeek.iterations;
        console.log("Ex-Showroom target :", exShowroomTarget, "| NSP :", solvedNSP.toFixed(2), "| iterations :", iterations);
 
        // On-Road helper: moves with Ex-Showroom (RTO + insurance), anchored on the MTS baseline
        const onRoadAt = buildOnRoadFn(mtsPricingResult);
        const onRoadFromNSP = nsp => mtsOnRoad + onRoadAt(exFn(nsp)) - onRoadAt(mtsExShowroom);
 
        // Spec 6: if parts also load the On-Road price, goal seek NSP again on the On-Road target
        let onRoadTarget = onRoadFromNSP(solvedNSP) + miyOnRoadTotal;
 
        if (miyOnRoadTotal > 0) {
            const orSeek = goalSeekNSP(onRoadTarget, onRoadFromNSP);
            if (!orSeek)
                return req.reject(422, `Could not solve NSP for On-Road target ${onRoadTarget}`);
 
            solvedNSP = orSeek.nsp;
            iterations += orSeek.iterations;
            console.log("On-Road target :", onRoadTarget, "| NSP :", solvedNSP.toFixed(2), "| iterations :", orSeek.iterations);
        }
 
        const actualNSP = round2(solvedNSP);
        const expectedExShowroom = round2(exFn(actualNSP));
        const expectedOnRoad = round2(onRoadFromNSP(actualNSP));
        incrementDealer = round2(incrementDealer);
 
        console.log("\nMTO RESULT");
        console.log("MTS NSP :", mtsNSP, "-> MTO NSP :", actualNSP);
        console.log("MTS Ex-Showroom :", mtsExShowroom, "-> MTO :", expectedExShowroom);
        console.log("MTS On-Road :", mtsOnRoad, "-> MTO :", expectedOnRoad);
 
        // ---------------------------------------------------------------
        console.log("\nSTEP 6: GENERATE MTO MODEL");
 
        const existingMTOModel = await tx.run(SELECT.one.from(Models).where({ modelCode: mtoModelCode }));
 
        const mtoModelData = {
            modelCode: mtoModelCode,
            validFrom: mtoConfiguration.validFrom,
            orderType: "MTO",
            modelDescription: mtsModel.modelDescription,
            engineType: mtsModel.engineType,
            ccWatt: mtsModel.ccWatt,
            gstPercent: mtsModel.gstPercent,
            dealerMarginPercent: mtsModel.dealerMarginPercent,
            csdDiscountPercent: mtsModel.csdDiscountPercent,
            csdGstPercent: mtsModel.csdGstPercent,
            gemValue: mtsModel.gemValue,
            status: "ACTIVE",
            approvalStatus: "DRAFT"
        };
 
        if (existingMTOModel) {
            await tx.run(UPDATE(Models).set(mtoModelData).where({ modelCode: mtoModelCode }));
            console.log("Existing MTO Model updated :", mtoModelCode);
        } else {
            await tx.run(INSERT.into(Models).entries(mtoModelData));
            console.log("New MTO Model generated :", mtoModelCode);
        }
 
        // ---------------------------------------------------------------
        console.log("\nSTEP 7: GENERATE MTO PRICING RESULT");
 
        const existingMTOResult = await tx.run(
            SELECT.one.from(PricingResults).where({
                model_modelCode: mtoModelCode,
                region_regionCode: regionCode,
                orderType: "MTO"
            })
        );
 
        const pricingResultData = {
            model_modelCode: mtoModelCode,
            region_regionCode: regionCode,
            nspPrice: actualNSP,
            orderType: "MTO",
            actualNSP: actualNSP,
            referenceMTSModel_modelCode: referenceMTSModel,
            mtsExShowroom: mtsExShowroom,
            mtsOnRoad: mtsOnRoad,
            miyExShowroomTotal: miyExShowroomTotal,
            miyOnRoadTotal: miyOnRoadTotal,
            expectedExShowroom: expectedExShowroom,
            expectedOnRoad: expectedOnRoad,
            exShowroomPrice: expectedExShowroom,
            onRoadPrice: expectedOnRoad,
            incrementDealer: incrementDealer,
            status: "DRAFT"
        };
 
        let generatedPricingResultID;
 
        if (existingMTOResult) {
            await tx.run(UPDATE(PricingResults).set(pricingResultData).where({ ID: existingMTOResult.ID }));
            generatedPricingResultID = existingMTOResult.ID;
            console.log("Existing MTO PricingResult updated :", generatedPricingResultID);
        } else {
            generatedPricingResultID = cds.utils.uuid();
            await tx.run(INSERT.into(PricingResults).entries({ ID: generatedPricingResultID, ...pricingResultData }));
            console.log("New MTO PricingResult generated :", generatedPricingResultID);
        }
 
        // Spec 8: part-wise breakup is written to the log (returning it would need a new field in MTOResult)
        console.log("\nPART-WISE BREAKUP");
        console.table(partBreakup);
        console.log("Ex-Showroom target :", round2(exShowroomTarget), "| On-Road target :", round2(onRoadTarget));
 
        // MTS baseline and MTO/Expected figures side by side (existing MTOResult fields only)
        results.push({
            modelCode: modelCode,
            mtoModelCode: mtoModelCode,
            regionCode: regionCode,
            engineType: mtsModel.engineType,
            orderType: "MTO",
            referenceMTSModel: referenceMTSModel,
            mtsNSP: mtsNSP,
            mtsExShowroom: mtsExShowroom,
            mtsOnRoad: mtsOnRoad,
            miyExShowroomTotal: miyExShowroomTotal,
            miyOnRoadTotal: miyOnRoadTotal,
            expectedExShowroom: expectedExShowroom,
            expectedOnRoad: expectedOnRoad,
            actualNSP: actualNSP,
            exShowroomPrice: expectedExShowroom,
            onRoadPrice: expectedOnRoad,
            incrementDealer: incrementDealer,
            iterations: iterations
        });
 
        console.log("MTO CALCULATION COMPLETE | PricingResult ID :", generatedPricingResultID);
        console.log("========================================");
    }
 
    return results;
}
 
module.exports = calculateMTO;