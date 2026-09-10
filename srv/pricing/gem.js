async function calculateGeM(modelCode) {
    const { PricingResults, Models } = cds.entities("vehicle.db");

    // 1. Validate Model

    const model = await SELECT.one
        .from(Models)
        .where({ modelCode });

    if (!model) {
        throw new Error(`Model ${modelCode} not found`);
    }


    // 2. Get APPROVED MTS pricing for this model across ALL regions

    const mtsPrices = await SELECT
        .from(PricingResults)
        .where({
            modelCode: modelCode,
            orderType: "MTS",
            approvalStatus: "APPROVED"
        });

    if (!mtsPrices.length) {
        throw new Error(
            `No approved MTS pricing found for model ${modelCode}`
        );
    }

    // 3. Find LOWEST Ex-Showroom across ALL regions

    const lowestPriceLine = mtsPrices.reduce(
        (lowest, current) =>
            Number(current.exShowroomPrice) <
                Number(lowest.exShowroomPrice)
                ? current
                : lowest
    );

    // 4. Get lowest approved MTS Ex-Showroom

    const mtsExShowroom = Number(
        lowestPriceLine.exShowroomPrice
    );

    // 5. GeM Discount
    //    Standard discount = 12%

    const discountPercent = 12;

    const discountAmount = mtsExShowroom * (discountPercent / 100);

    // 6. Final GeM Price
    //    Sub-Total = Ex-Showroom - Discount

    const gemPrice = mtsExShowroom - discountAmount;

    // 7. Get GST % from Model Master

    const gstPercent = Number(
        model.gstPercent || 0
    );

    // 8. Back out GST
    //    GeM Basic = Sub-Total / (1 + GST %)

    const gemBasic = gemPrice / (1 + gstPercent / 100);

    // 9. Calculate GeM GST Amount
    //    GST Amount = Sub-Total - GeM Basic

    const gemGSTAmount = gemPrice - gemBasic;

    // 10. Create PricingResults record
    const gemResult = {
        // Model
        model_modelCode: modelCode,

        // GeM
        orderType: "GEM",

        lowestMtsExShowroom:
            Number(mtsExShowroom.toFixed(2)),

        gemDiscountPercent:
            Number(discountPercent.toFixed(2)),

        gemDiscountAmount:
            Number(discountAmount.toFixed(2)),

        gemSubTotal:
            Number(gemPrice.toFixed(2)),

        gemBasic:
            Number(gemBasic.toFixed(2)),

        gemGstAmount:
            Number(gemGSTAmount.toFixed(2)),

        finalGemPrice:
            Number(gemPrice.toFixed(2)),

        // Initial approval status
        status: "DRAFT"
    };

    // 11. Save into PricingResults
    await INSERT
        .into(PricingResults)
        .entries(gemResult);
}

module.exports = {
    calculateGeM
}