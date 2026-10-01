const cds = require("@sap/cds");
const { calculateMTS } = require("./pricing/mts");
const calculateMTO = require("./pricing/mto");
const { calculateEV } = require("./pricing/ev");
const { calculateGeM } = require("./pricing/gem");
const { calculateCSD } = require("./pricing/csd");
const { INSERT } = require("@sap/cds/lib/ql/cds-ql");
const { submitPricing } = require("./workflow/submission");
const { approvePricing, rejectPricing } = require("./workflow/approval");
// const { calculateMultiRegion } = require("./region/multiRegion");

module.exports = cds.service.impl(async function () {


    const { PricingResults } = this.entities;
    const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

    // ---------  MTS Handler  ----------
    this.on('calculateMTS', async (req) => {

        // console.log(req.data);  

        const NSP = req.data.NSP;
        const regionCode = req.data.regionCode;
        const engineType = req.data.engineType;
        const modelCode = req.data.modelCode;

        // console.log(input);

        const result = await calculateMTS(
            NSP,
            regionCode,
            engineType,
            modelCode

        );

        const ID = cds.utils.uuid();

        await INSERT.into(PricingResults).entries({
            ID,

            /* References */
            model_modelCode: modelCode,
            region_regionCode: regionCode,
            orderType: "MTS",
            nspPrice: result.NSP,

            /* Input */
            inputNSP: result.NSP,
            actualNSP: result.NSP,

            /* MTS */
            helmet: result.helmet,
            transportation: result.transportation,
            dealerCost: result.dealerCost,
            otherExpenses: result.otherExpenses,
            dealerMargin: result.dealerMargin,
            helmetMargin: result.helmetMargin,
            totalDealerMargin: result.totalDealerMargin,
            ndp: result.NDP,
            basicPrice: result.basicPrice,
            gstAmount: result.gstAmount,
            exShowroomPrice: r2(result.exShowroomPrice),

            /* RTO */
            rtoPercent: result.rtoPercent,
            rtoAmount: r2(result.rtoAmount),
            rtoWithBill: r2(result.rtoWithBill),

            /* Insurance */
            insuranceRate: result.insuranceRate,
            insuranceAmount: result.insuranceAmount,
            tpaPa: result.tpaPa,
            insuranceGst: result.insuranceGst,
            totalInsurance: r2(result.totalInsurance),

            /* Final */
            onRoadPrice: r2(result.onRoadPrice),
            status: "DRAFT"
        });

        return { ...result, ID };

    });



    this.on("calculateMTO", calculateMTO);



    this.on("calculateEV", async (req) => {

        const result = await calculateEV(req);

        const ID = cds.utils.uuid();

        await INSERT.into(PricingResults).entries({
            ID,
            orderType: "EV",
            status: "DRAFT",

            model_modelCode: result.modelCode,
            region_regionCode: result.regionCode,

            nspPrice: r2(result.nsp),
            inputNSP: r2(result.nsp),
            actualNSP: r2(result.nsp),

            transportation: r2(result.transportation),
            dealerCost: r2(result.nsp + result.transportation),
            otherExpenses: r2(result.otherExpenses),
            dealerMargin: r2(result.dealerMargin),
            totalDealerMargin: r2(result.dealerMargin),   // EV has no helmet margin
            basicPrice: r2(result.basicPrice),
            gstAmount: r2(result.gstAmount),
            exShowroomPrice: r2(result.exShowroomPrice),

            rtoPercent: result.rtoPercent,
            rtoAmount: r2(result.rtoAmount),

            insuranceRate: result.insuranceRate,
            insuranceAmount: r2(result.insurance),
            tpaPa: r2(result.tpaPA),
            insuranceGst: 0,
            totalInsurance: r2(result.insurance + result.tpaPA),

            onRoadPrice: r2(result.onRoadPrice)
        });

        return { ...result, ID };


    });



    this.on("calculateGeM", async (req) => {

        const { modelCodes } = req.data;
        const result = await calculateGeM(modelCodes);
    });

    this.on("calculateCSD", calculateCSD);

    this.on("submitPricing", submitPricing);

    this.on("approvePricing", approvePricing);

    this.on("rejectPricing", rejectPricing);

    // this.on("calculateMultiRegion", calculateMultiRegion);

});