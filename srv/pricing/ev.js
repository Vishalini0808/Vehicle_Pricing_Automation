const cds = require("@sap/cds");
const { SELECT } = cds.ql;


async function calculateEV(req) {

    const {
        Models,
        PricingComponents,
        RTOMasters
    } = cds.entities("vehicle.db");


    // =====================================================
    // 1. GET INPUT
    // =====================================================

    const item = req.data.item;

    if (!item) {
        return req.reject(400, "EV input is required");
    }

    const modelCode = item.modelCode;
    const regionCode = item.regionCode;
    const nsp = Number(item.nsp);


    // =====================================================
    // 2. VALIDATE INPUT
    // =====================================================

    if (!modelCode) {
        return req.reject(
            400,
            "EV Model Code is required"
        );
    }

    if (!regionCode) {
        return req.reject(
            400,
            "Region Code is required"
        );
    }

    if (!nsp || nsp <= 0) {
        return req.reject(
            400,
            "EV NSP must be greater than 0"
        );
    }


    // =====================================================
    // 3. GET MODEL
    // =====================================================

    const model = await SELECT.one
        .from(Models)
        .where({
            modelCode: modelCode
        });


    if (!model) {
        return req.reject(
            404,
            `Model ${modelCode} not found`
        );
    }


    // =====================================================
    // 4. CHECK EV MODEL
    // =====================================================

    if (
        String(model.engineType).toUpperCase() !== "EV"
    ) {
        return req.reject(
            400,
            `Model ${modelCode} is not an EV model`
        );
    }


    // =====================================================
    // 5. GET EV PRICING COMPONENT
    // =====================================================

    const pricing = await SELECT.one
        .from(PricingComponents)
        .where({
            regionCode: regionCode,
            engineType: "EV"
        });


    if (!pricing) {
        return req.reject(
            404,
            `EV pricing component not found for ${regionCode}`
        );
    }


    // =====================================================
    // 6. TRANSPORTATION
    // =====================================================

    const transportation =
        Number(pricing.transportation || 0);


    // =====================================================
    // 7. OTHER EXPENSES
    // =====================================================

    const otherExpenses =
        Number(pricing.otherExpensesBelow500 || 0);


    // =====================================================
    // 8. DEALER COST
    // =====================================================

    const dealerCost =
        nsp +
        transportation;


    // =====================================================
    // 9. DEALER MARGIN
    // =====================================================

    const dealerMarginPercent =
        Number(model.dealerMarginPercent || 0);


    const dealerMargin =
        dealerCost *
        dealerMarginPercent /
        100;


    // =====================================================
    // 10. BASIC PRICE
    // =====================================================

    const basicPrice =
        dealerCost +
        otherExpenses +
        dealerMargin;


    // =====================================================
    // 11. GST
    // =====================================================

    const gstPercent =
        Number(model.gstPercent || 0);


    const gstAmount =
        basicPrice *
        gstPercent /
        100;


    // =====================================================
    // 12. EX-SHOWROOM
    // =====================================================

    const exShowroomPrice =
        basicPrice +
        gstAmount;


    // =====================================================
    // 13. GET RTO MASTER
    // =====================================================

    const rtoMaster = await SELECT.one
        .from(RTOMasters)
        .where({
            region_regionCode: regionCode,
            engineType: "EV"
        });


    if (!rtoMaster) {
        return req.reject(
            404,
            `EV RTO master not found for ${regionCode}`
        );
    }


    // =====================================================
    // 14. RTO CALCULATION
    // =====================================================

    const rtoPercent =
        Number(rtoMaster.rtoPercent || 0);


    const rtoAmount =
        exShowroomPrice *
        rtoPercent /
        100;


    // =====================================================
    // 15. INSURANCE
    // =====================================================

    const insuranceRate =
        Number(pricing.insuranceRateBelow350 || 0);


    const insurance =
        exShowroomPrice *
        insuranceRate /
        100;


    // =====================================================
    // 16. TPA / PA
    // =====================================================

    const tpaPA =
        Number(pricing.tpaPaBelow350 || 0);


    // =====================================================
    // 17. NUMBER PLATE
    // =====================================================

    const numberPlateCharges =
        Number(pricing.noPlateCharges || 0);


    // =====================================================
    // 18. ON-ROAD PRICE
    // =====================================================

    const onRoadPrice =
        exShowroomPrice +
        rtoAmount +
        insurance +
        tpaPA +
        numberPlateCharges;


    // =====================================================
    // 19. RETURN RESULT
    // =====================================================

    return {

        modelCode:
            modelCode,

        regionCode:
            regionCode,

        engineType:
            "EV",

        nsp:
            Number(nsp.toFixed(2)),

        transportation:
            Number(
                transportation.toFixed(2)
            ),

        otherExpenses:
            Number(
                otherExpenses.toFixed(2)
            ),

        dealerMargin:
            Number(
                dealerMargin.toFixed(2)
            ),

        basicPrice:
            Number(
                basicPrice.toFixed(2)
            ),

        gstAmount:
            Number(
                gstAmount.toFixed(2)
            ),

        exShowroomPrice:
            Number(
                exShowroomPrice.toFixed(2)
            ),

        rtoPercent:
            Number(
                rtoPercent.toFixed(4)
            ),

        rtoAmount:
            Number(
                rtoAmount.toFixed(2)
            ),

        insuranceRate:
            Number(
                insuranceRate.toFixed(4)
            ),

        insurance:
            Number(
                insurance.toFixed(2)
            ),

        tpaPA:
            Number(
                tpaPA.toFixed(2)
            ),

        numberPlateCharges:
            Number(
                numberPlateCharges.toFixed(2)
            ),

        onRoadPrice:
            Number(
                onRoadPrice.toFixed(2)
            )
    };
}


module.exports = {
    calculateEV
};