const cds = require("@sap/cds");
const { calculateMTS } = require("./pricing/mts");
const  calculateMTO = require("./pricing/mto");
const { calculateEV } = require("./pricing/ev");
//const { calculateGeM } = require("./pricing/gem");
// const { calculateCSD } = require("./pricing/csd");
// const { submitPricing } = require("./workflow/submission");
// const { approvePricing, rejectPricing } = require("./workflow/approval");
// const { calculateMultiRegion } = require("./region/multiRegion");

module.exports = cds.service.impl( async function () {

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

        return result;

    });


     this.on("calculateMTO", calculateMTO);

     this.on("calculateEV", calculateEV);

         
    //this.on("calculateGeM", calculateGeM);

    // this.on("calculateCSD", calculateCSD);

    // this.on("submitPricing", submitPricing);

    // this.on("approvePricing", approvePricing);

    // this.on("rejectPricing", rejectPricing);

    // this.on("calculateMultiRegion", calculateMultiRegion);

});