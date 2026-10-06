async function calculateCSD(modelCodes, regionCode) {

    const { PricingResults, Models } = cds.entities("vehicle.db");

    // Allow single modelCode or multiple modelCodes
    if (!Array.isArray(modelCodes)) {
        modelCodes = [modelCodes];
    }

    const results = [];

    // Calculate each model separately
    for (const modelCode of modelCodes) {

        console.log("\n================================");
        console.log("CSD CALCULATION");
        console.log("Model Code :", modelCode);
        console.log("Region Code:", regionCode);
        console.log("================================");

        // 1. Validate Model
        const model = await SELECT.one
            .from(Models)
            .where({ modelCode });

        if (!model) {
            throw new Error(`Model ${modelCode} not found`);
        }

        // 2. Get APPROVED MTS pricing
        const mtsPrice = await SELECT.one
            .from(PricingResults)
            .where({
                model_modelCode: modelCode,
                region_regionCode: regionCode,
                orderType: "MTS",
                status: "APPROVED"
            });

        if (!mtsPrice) {
            throw new Error(
                `No approved MTS pricing found for model ${modelCode} in region ${regionCode}`
            );
        }

        // 3. CSD NSP
        const csdNsp =
            Number(mtsPrice.actualNSP || 0) +
            Number(mtsPrice.transportation || 0) +
            Number(mtsPrice.otherExpenses || 0) +
            Number(mtsPrice.totalDealerMargin || 0);

        // 4. Basic Price excluding Helmet
        const csdBasicExclHelmet =
            Number(mtsPrice.basicPrice || 0) -
            Number(mtsPrice.helmet || 0) -
            Number(mtsPrice.helmetMargin || 0);

        // 5. CSD Discount %
        const csdDiscountPercent =
            Number(model.csdDiscountPercent || 0);

        // 6. Discount Amount
        const csdDiscountAmount =
            csdNsp * (csdDiscountPercent / 100);

        // 7. Pre-Tax Net
        const csdPreTaxNet =
            csdBasicExclHelmet -
            csdDiscountAmount;

        // 8. CSD GST %
        const csdGstPercent =
            Number(model.csdGstPercent || 0);

        // 9. CSD GST Amount
        const csdGstAmount =
            csdPreTaxNet * (csdGstPercent / 100);

        // 10. CSD Ex-Showroom
        const csdExShowroom =
            csdPreTaxNet +
            csdGstAmount;

        // 11. Incidental %
        const incidentalPercent = 1;

        // 12. Incidental Charges
        const incidentalCharges =
            csdPreTaxNet *
            (incidentalPercent / 100);

        // 13. Final CSD Price
        const finalCsdPrice =
            csdExShowroom +
            incidentalCharges;

        // 14. CSD On-Road
        const csdOnRoad =
            csdExShowroom +
            Number(mtsPrice.rtoAmount || 0) +
            Number(mtsPrice.rtoWithBill || 0) +
            Number(mtsPrice.totalInsurance || 0);

        // 15. Create CSD PricingResults record
        const csdResult = {

            model_modelCode: modelCode,

            region_regionCode: regionCode,

            orderType: "CSD",

            csdNsp:
                Number(csdNsp.toFixed(2)),

            csdBasicExclHelmet:
                Number(csdBasicExclHelmet.toFixed(2)),

            csdDiscountPercent:
                Number(csdDiscountPercent.toFixed(2)),

            csdDiscountAmount:
                Number(csdDiscountAmount.toFixed(2)),

            csdPreTaxNet:
                Number(csdPreTaxNet.toFixed(2)),

            csdGstPercent:
                Number(csdGstPercent.toFixed(2)),

            csdGstAmount:
                Number(csdGstAmount.toFixed(2)),

            csdExShowroom:
                Number(csdExShowroom.toFixed(2)),

            incidentalPercent:
                Number(incidentalPercent.toFixed(2)),

            incidentalCharges:
                Number(incidentalCharges.toFixed(2)),

            finalCsdPrice:
                Number(finalCsdPrice.toFixed(2)),

            csdOnRoad:
                Number(csdOnRoad.toFixed(2)),

            status: "DRAFT"
        };

        // 16. Save CSD result
        await INSERT
            .into(PricingResults)
            .entries(csdResult);

        // Add result to response
        results.push(csdResult);
    }

    // Return all calculated models
    return results;
}

module.exports = {
    calculateCSD
};