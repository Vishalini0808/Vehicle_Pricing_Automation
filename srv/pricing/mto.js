const cds = require("@sap/cds");
const { SELECT, INSERT, UPDATE } = cds.ql;
const { Models, PricingResults, MTOConfigurations, Parts } = cds.entities("vehicle.db");

async function calculateMTO(req) {
    const tx = cds.tx(req);
    const items = req.data.items || [];
    const results = [];

    if (items.length === 0) req.error(400, "Please provide at least one MTO item");

    for (const item of items) {
        const { modelCode, regionCode, engineType, orderType, validFrom, parts } = item;

        console.log("\n========================================");
        console.log("MTO CALCULATION START");
        console.log("MTS Model :", modelCode);
        console.log("Region :", regionCode);
        console.log("Engine :", engineType);
        console.log("Order Type :", orderType);
        console.log("Date :", validFrom);

        if (!modelCode) req.error(400, "modelCode is required");
        if (!regionCode) req.error(400, "regionCode is required");
        if (!validFrom) req.error(400, "validFrom is required");
        if (orderType !== "MTO") req.error(400, "orderType must be MTO");

        console.log("\nSTEP 1: FIND MTO CONFIGURATION");

        const configurations = await tx.run(SELECT.from(MTOConfigurations).where({ referenceMTSModel_modelCode: modelCode }));

        if (!configurations || configurations.length === 0) req.error(404, `MTO Configuration not found for MTS model ${modelCode}`);

        const selectedDate = new Date(validFrom);

        const validConfigurations = configurations.filter(config => config.validFrom && new Date(config.validFrom) <= selectedDate).sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom));

        if (validConfigurations.length === 0) req.error(404, `No valid MTO Configuration found for ${modelCode} on ${validFrom}`);

        const mtoConfiguration = validConfigurations[0];
        const mtoModelCode = mtoConfiguration.mtoModelCode;
        const referenceMTSModel = mtoConfiguration.referenceMTSModel_modelCode;

        console.log("MTO Model Code :", mtoModelCode);
        console.log("Valid From :", mtoConfiguration.validFrom);
        console.log("Reference MTS :", referenceMTSModel);

        console.log("\nSTEP 2: FIND MTS MODEL");

        const mtsModel = await tx.run(SELECT.one.from(Models).where({ modelCode: modelCode }));

        if (!mtsModel) req.error(404, `MTS Model ${modelCode} not found`);

        console.log("MTS Model found :", mtsModel.modelCode);

        if (engineType && mtsModel.engineType !== engineType) req.error(400, `Engine type ${engineType} does not match MTS Model ${modelCode}`);

console.log("\nSTEP 3: CHECK MTS PRICING RESULT");

const allPricingResults = await tx.run(SELECT.from(PricingResults));

console.log("TOTAL PRICING RESULTS :", allPricingResults.length);

const mtsPricingResult = allPricingResults.find(row =>
    row.model_modelCode === modelCode &&
    row.region_regionCode === regionCode &&
    row.orderType === "MTS"
);

if (!mtsPricingResult) {
    req.error(404, `MTS PricingResult not found for ${modelCode} / ${regionCode}`);
}

console.log("MTS PricingResult found");
console.log("Status :", mtsPricingResult.status);
console.log("Actual NSP :", mtsPricingResult.actualNSP);
console.log("Ex-Showroom :", mtsPricingResult.exShowroomPrice);
console.log("On-Road :", mtsPricingResult.onRoadPrice);

const mtsNSP = Number(mtsPricingResult.actualNSP || 0);
const mtsExShowroom = Number(mtsPricingResult.exShowroomPrice || 0);
const mtsOnRoad = Number(mtsPricingResult.onRoadPrice || 0);
        console.log("\nSTEP 4: FIND SELECTED PARTS");

        let miyExShowroomTotal = 0;
        let miyOnRoadTotal = 0;
        const selectedParts = parts || [];

        for (const selectedPart of selectedParts) {
            const partCode = selectedPart.partCode;
            const quantity = Number(selectedPart.quantity || 1);

            if (!partCode) req.error(400, "partCode is required");
            if (quantity <= 0) req.error(400, `Quantity must be greater than 0 for ${partCode}`);

            const part = await tx.run(SELECT.one.from(Parts).where({ partCode: partCode }));

            if (!part) req.error(404, `Part ${partCode} not found`);

            const miyCost = Number(part.miyCost || 0);
            const miyMarkup = Number(part.miyMarkup || 0);
            const partPrice = miyCost + miyMarkup;
            const totalPartPrice = partPrice * quantity;

            console.log("\nPART");
            console.log("Part Code :", partCode);
            console.log("Description :", part.description);
            console.log("MIY Cost :", miyCost);
            console.log("MIY Markup :", miyMarkup);
            console.log("Quantity :", quantity);
            console.log("Part Price :", partPrice);
            console.log("Total Price :", totalPartPrice);
            console.log("Price Type :", part.priceIndicator);

            if (part.priceIndicator === "EXSHOWROOM") miyExShowroomTotal += totalPartPrice;
            else if (part.priceIndicator === "ONROAD") miyOnRoadTotal += totalPartPrice;
            else console.log("Warning: Unknown priceIndicator :", part.priceIndicator);
        }

        console.log("\nPART TOTALS");
        console.log("MIY Ex-Showroom :", miyExShowroomTotal);
        console.log("MIY On-Road :", miyOnRoadTotal);

        console.log("\nSTEP 5: CALCULATE MTO");

        const actualNSP = mtsNSP + miyExShowroomTotal;
        const expectedExShowroom = mtsExShowroom + miyExShowroomTotal;
        const expectedOnRoad = mtsOnRoad + miyExShowroomTotal + miyOnRoadTotal;
        const incrementDealer = 0;

        console.log("\nMTO CALCULATION");
        console.log("MTS NSP :", mtsNSP);
        console.log("MIY Ex-Showroom :", miyExShowroomTotal);
        console.log("MTO Actual NSP :", actualNSP);
        console.log("MTS Ex-Showroom :", mtsExShowroom);
        console.log("MTO Ex-Showroom :", expectedExShowroom);
        console.log("MTS On-Road :", mtsOnRoad);
        console.log("MIY On-Road :", miyOnRoadTotal);
        console.log("MTO On-Road :", expectedOnRoad);

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

        console.log("\nSTEP 7: GENERATE MTO PRICING RESULT");

        const existingMTOResult = await tx.run(SELECT.one.from(PricingResults).where({ model_modelCode: mtoModelCode, region_regionCode: regionCode, orderType: "MTO" }));

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

        const result = {
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
            iterations: 1
        };

        results.push(result);

        console.log("\n========================================");
        console.log("MTO CALCULATION COMPLETE");
        console.log("========================================");
        console.log("MTS Model :", modelCode);
        console.log("MTO Model :", mtoModelCode);
        console.log("Region :", regionCode);
        console.log("MTS NSP :", mtsNSP);
        console.log("MIY ExShowroom :", miyExShowroomTotal);
        console.log("MIY OnRoad :", miyOnRoadTotal);
        console.log("MTO NSP :", actualNSP);
        console.log("MTO ExShowroom :", expectedExShowroom);
        console.log("MTO OnRoad :", expectedOnRoad);
        console.log("PricingResult ID :", generatedPricingResultID);
        console.log("========================================");
    }

    return results;
}

module.exports = calculateMTO;