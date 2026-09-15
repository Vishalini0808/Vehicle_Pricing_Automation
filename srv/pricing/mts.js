async function calculateMTS(req) {

    const { Models, PricingComponents } =
        cds.entities("vehicle.db");

    // 1. Get input
    const item = req.data.item;

    const modelCode = item.modelCode;
    const nsp = Number(item.nsp);
    const regionCode = item.regionCode;


    // 2. Get model
    const model = await SELECT.one
        .from(Models)
        .where({
            modelCode: modelCode
        });

    if (!model) {
        req.error(404, `Model ${modelCode} not found`);
    }


    // 3. Get pricing component
    const pricing = await SELECT.one
        .from(PricingComponents)
        .where({
            regionCode: regionCode,
            engineType: model.engineType
        });

    if (!pricing) {
        req.error(
            404,
            `Pricing component not found for ${regionCode}`
        );
    }


    // 4. Helmet
    const helmet = Number(pricing.helmet);


    // 5. Transportation
    const transportation =
        Number(pricing.transportation);


    // 6. Dealer Cost
    // NSP + Helmet + Transportation

    const dealerCost =
        nsp +
        helmet +
        transportation;


    // 7. Other Expenses
    let otherExpenses;

    if (Number(model.ccWatt) <= 500) {

        otherExpenses =
            Number(pricing.otherExpensesBelow500);

    } else {

        otherExpenses =
            Number(pricing.otherExpensesAbove500);
    }


    // 8. Dealer Margin
    const dealerMarginPercent =
        Number(model.dealerMarginPercent);

    const dealerMargin =
        dealerCost *
        dealerMarginPercent / 100;


    // 9. Helmet Margin
    const helmetMargin =
        Number(pricing.helmetMargin);


    // 10. Total Dealer Margin

    const totalDealerMargin =
        dealerMargin +
        helmetMargin;


    // 11. Basic Price
    //
    // Dealer Cost
    // + Other Expenses
    // + Total Dealer Margin

    const basicPrice =
        dealerCost +
        otherExpenses +
        totalDealerMargin;


    // 12. GST

    const gstPercent =
        Number(model.gstPercent);

    const gstAmount =
        basicPrice *
        gstPercent / 100;


    // 13. MTS Ex-Showroom

    const exShowroomPrice =
        basicPrice +
        gstAmount;


    // 14. Return result

    return {

        modelCode: modelCode,

        regionCode: regionCode,

        actualNSP:
            Number(nsp.toFixed(2)),

        helmet:
            Number(helmet.toFixed(2)),

        transportation:
            Number(transportation.toFixed(2)),

        dealerCost:
            Number(dealerCost.toFixed(2)),

        otherExpenses:
            Number(otherExpenses.toFixed(2)),

        dealerMargin:
            Number(dealerMargin.toFixed(2)),

        helmetMargin:
            Number(helmetMargin.toFixed(2)),

        totalDealerMargin:
            Number(totalDealerMargin.toFixed(2)),

        basicPrice:
            Number(basicPrice.toFixed(2)),

        gstAmount:
            Number(gstAmount.toFixed(2)),

        exShowroomPrice:
            Number(exShowroomPrice.toFixed(2))
    };
}


module.exports = {
    calculateMTS
};