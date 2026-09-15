// const cds = require("@sap/cds");
// const { SELECT } = cds.ql;

// const { calculateMTS } = require("./mts");

// async function calculateMTO(req) {

//     const {
//         Models,
//         MTOConfigurations,
//         MTOConfigurationParts,
//         Parts,
//         PricingResults
//     } = cds.entities("vehicle.db");


//     // =========================================================
//     // 1. Get user input
//     // =========================================================

//     const item = req.data.item;

//     if (!item) {
//         return req.reject(400, "MTO input is required");
//     }

//     const mtoModelCode = item.mtoModelCode;
//     const regionCode = item.regionCode;


//     if (!mtoModelCode) {
//         return req.reject(400, "MTO Model Code is required");
//     }

//     if (!regionCode) {
//         return req.reject(400, "Region Code is required");
//     }


//     // =========================================================
//     // 2. Get MTO Configuration
//     // =========================================================

//     const configuration = await SELECT.one
//         .from(MTOConfigurations)
//         .where({
//             mtoModelCode: mtoModelCode
//         });


//     if (!configuration) {
//         return req.reject(
//             404,
//             `MTO configuration ${mtoModelCode} not found`
//         );
//     }


//     // =========================================================
//     // 3. Get Reference MTS Model
//     // =========================================================

//     const referenceMTSModel =
//         configuration.referenceMTSModel_modelCode;


//     if (!referenceMTSModel) {
//         return req.reject(
//             400,
//             `Reference MTS model not found for ${mtoModelCode}`
//         );
//     }


//     // =========================================================
//     // 4. Check Reference MTS Model
//     // =========================================================

//     const mtsModel = await SELECT.one
//         .from(Models)
//         .where({
//             modelCode: referenceMTSModel
//         });


//     if (!mtsModel) {
//         return req.reject(
//             404,
//             `Reference MTS model ${referenceMTSModel} not found`
//         );
//     }


//     // =========================================================
//     // 5. Get APPROVED MTS Pricing Result
//     // =========================================================

//     const mtsResult = await SELECT.one
//         .from(PricingResults)
//         .where({
//             model_modelCode: referenceMTSModel,
//             region_regionCode: regionCode,
//             orderType: "MTS",
//             status: "APPROVED"
//         });


//     // IMPORTANT:
//     // req.reject stops execution.
//     // req.error was allowing the code to continue.
//     // =========================================================

//     if (!mtsResult) {
//         return req.reject(
//             400,
//             `Approved MTS price not found for ${referenceMTSModel} in ${regionCode}`
//         );
//     }


//     // =========================================================
//     // 6. Read MTS baseline values
//     // =========================================================

//     const mtsNSP =
//         Number(
//             mtsResult.actualNSP ??
//             mtsResult.inputNSP ??
//             mtsResult.nspPrice ??
//             0
//         );


//     const mtsExShowroom =
//         Number(
//             mtsResult.exShowroomPrice ??
//             mtsResult.exShowroomInput ??
//             0
//         );


//     const mtsOnRoad =
//         Number(
//             mtsResult.onRoadPrice ??
//             0
//         );


//     if (mtsNSP <= 0) {
//         return req.reject(
//             400,
//             `Invalid MTS NSP for ${referenceMTSModel}`
//         );
//     }


//     if (mtsExShowroom <= 0) {
//         return req.reject(
//             400,
//             `Invalid MTS Ex-Showroom price for ${referenceMTSModel}`
//         );
//     }


//     // =========================================================
//     // 7. Get MTO Parts
//     // =========================================================

//     const configurationParts = await SELECT
//         .from(MTOConfigurationParts)
//         .where({
//             configuration_mtoModelCode: mtoModelCode
//         });


//     if (!configurationParts.length) {
//         return req.reject(
//             400,
//             `No parts configured for ${mtoModelCode}`
//         );
//     }


//     // =========================================================
//     // 8. Calculate MIY
//     // =========================================================

//     let miyExShowroomTotal = 0;
//     let miyOnRoadTotal = 0;
//     let incrementDealer = 0;


//     for (const configurationPart of configurationParts) {

//         const partCode =
//             configurationPart.part_partCode;

//         const quantity =
//             Number(configurationPart.quantity || 0);


//         if (!partCode) {
//             return req.reject(
//                 400,
//                 `Part not maintained for part number ${configurationPart.partNo}`
//             );
//         }


//         if (quantity <= 0) {
//             return req.reject(
//                 400,
//                 `Invalid quantity for part ${partCode}`
//             );
//         }


//         // =====================================================
//         // Get Part Master
//         // =====================================================

//         const part = await SELECT.one
//             .from(Parts)
//             .where({
//                 partCode: partCode
//             });


//         if (!part) {
//             return req.reject(
//                 404,
//                 `Part ${partCode} not found`
//             );
//         }


//         const miyCost =
//             Number(part.miyCost || 0);

//         const miyMarkup =
//             Number(part.miyMarkup || 0);

//         const totalMIYCost =
//             miyCost * quantity;


//         // =====================================================
//         // EXSHOWROOM
//         // =====================================================

//         if (
//             String(part.priceIndicator)
//                 .trim()
//                 .toUpperCase() === "EXSHOWROOM"
//         ) {

//             miyExShowroomTotal +=
//                 totalMIYCost;
//         }


//         // =====================================================
//         // ONROAD
//         // =====================================================

//         else if (
//             String(part.priceIndicator)
//                 .trim()
//                 .toUpperCase() === "ONROAD"
//         ) {

//             miyOnRoadTotal +=
//                 totalMIYCost;
//         }


//         // =====================================================
//         // Increment Dealer
//         // =====================================================

//         incrementDealer +=
//             miyMarkup * quantity;
//     }


//     // =========================================================
//     // 9. Expected MTO Ex-Showroom
//     // =========================================================

//     const expectedExShowroom =
//         mtsExShowroom +
//         miyExShowroomTotal;


//     // =========================================================
//     // 10. Expected MTO On-Road
//     // =========================================================

//     const expectedOnRoad =
//         mtsOnRoad +
//         miyExShowroomTotal +
//         miyOnRoadTotal;


//     // =========================================================
//     // 11. GOAL SEEK
//     //
//     // Start from approved MTS NSP.
//     // Run existing MTS calculation.
//     // Compare calculated Ex-Showroom.
//     // Increase / decrease NSP by ₹1.
//     // =========================================================

//     let trialNSP = mtsNSP;

//     let finalMTSCalculation = null;

//     const targetExShowroom =
//         expectedExShowroom;

//     const maxIterations = 100000;


//     for (
//         let iteration = 1;
//         iteration <= maxIterations;
//         iteration++
//     ) {

//         // =====================================================
//         // Run existing MTS calculation
//         // DO NOT CHANGE mts.js
//         // =====================================================

//         const mtsCalculation =
//             await calculateMTS({
//                 data: {
//                     item: {
//                         modelCode:
//                             referenceMTSModel,

//                         nsp:
//                             trialNSP,

//                         regionCode:
//                             regionCode
//                     }
//                 }
//             });


//         // =====================================================
//         // Check MTS response
//         // =====================================================

//         if (!mtsCalculation) {
//             return req.reject(
//                 400,
//                 "MTS calculation did not return a result"
//             );
//         }


//         const calculatedExShowroom =
//             Number(
//                 mtsCalculation.exShowroomPrice ??
//                 0
//             );


//         if (calculatedExShowroom <= 0) {
//             return req.reject(
//                 400,
//                 "MTS calculation returned an invalid Ex-Showroom price"
//             );
//         }


//         // =====================================================
//         // Difference
//         // =====================================================

//         const difference =
//             targetExShowroom -
//             calculatedExShowroom;


//         // =====================================================
//         // Target reached
//         // =====================================================

//         if (
//             Math.abs(difference) <= 1
//         ) {

//             finalMTSCalculation =
//                 mtsCalculation;

//             break;
//         }


//         // =====================================================
//         // Target is higher
//         // Increase NSP by ₹1
//         // =====================================================

//         if (difference > 0) {

//             trialNSP =
//                 trialNSP + 1;
//         }


//         // =====================================================
//         // Target is lower
//         // Decrease NSP by ₹1
//         // =====================================================

//         else {

//             trialNSP =
//                 trialNSP - 1;
//         }


//         // =====================================================
//         // Prevent negative NSP
//         // =====================================================

//         if (trialNSP < 0) {
//             return req.reject(
//                 400,
//                 "Goal Seek resulted in negative NSP"
//             );
//         }
//     }


//     // =========================================================
//     // 12. Check Goal Seek
//     // =========================================================

//     if (!finalMTSCalculation) {
//         return req.reject(
//             400,
//             `MTO Goal Seek could not reach Ex-Showroom target ₹${targetExShowroom}`
//         );
//     }


//     // =========================================================
//     // 13. Final MTO NSP
//     // =========================================================

//     const mtoNSP =
//         Number(
//             finalMTSCalculation.actualNSP ??
//             trialNSP
//         );


//     // =========================================================
//     // 14. Final MTO Ex-Showroom
//     // =========================================================

//     const mtoExShowroom =
//         Number(
//             finalMTSCalculation.exShowroomPrice
//         );


//     // =========================================================
//     // 15. MTO On-Road
//     //
//     // Your existing mts.js returns Ex-Showroom.
//     // So we use the approved MTS On-Road baseline.
//     // =========================================================

//     const mtoOnRoad =
//         expectedOnRoad;


//     // =========================================================
//     // 16. Return MTO Result
//     // =========================================================

//     return {

//         mtoModelCode:
//             mtoModelCode,

//         referenceMTSModel:
//             referenceMTSModel,

//         regionCode:
//             regionCode,


//         // =====================================================
//         // MTS BASELINE
//         // =====================================================

//         mtsNSP:
//             Number(
//                 mtsNSP.toFixed(2)
//             ),

//         mtsExShowroom:
//             Number(
//                 mtsExShowroom.toFixed(2)
//             ),

//         mtsOnRoad:
//             Number(
//                 mtsOnRoad.toFixed(2)
//             ),


//         // =====================================================
//         // MIY
//         // =====================================================

//         miyExShowroomTotal:
//             Number(
//                 miyExShowroomTotal.toFixed(2)
//             ),

//         miyOnRoadTotal:
//             Number(
//                 miyOnRoadTotal.toFixed(2)
//             ),


//         // =====================================================
//         // EXPECTED MTO
//         // =====================================================

//         expectedExShowroom:
//             Number(
//                 expectedExShowroom.toFixed(2)
//             ),

//         expectedOnRoad:
//             Number(
//                 expectedOnRoad.toFixed(2)
//             ),


//         // =====================================================
//         // FINAL MTO
//         // =====================================================

//         mtoNSP:
//             Number(
//                 mtoNSP.toFixed(2)
//             ),

//         mtoExShowroom:
//             Number(
//                 mtoExShowroom.toFixed(2)
//             ),

//         mtoOnRoad:
//             Number(
//                 mtoOnRoad.toFixed(2)
//             ),


//         // =====================================================
//         // DEALER
//         // =====================================================

//         incrementDealer:
//             Number(
//                 incrementDealer.toFixed(2)
//             )
//     };
// }


// module.exports = {
//     calculateMTO
// };

const cds = require("@sap/cds");
const { SELECT } = cds.ql;

const { calculateMTS } = require("./mts");

async function calculateMTO(req) {

    const {
        Models,
        MTOConfigurations,
        MTOConfigurationParts,
        Parts
    } = cds.entities("vehicle.db");


    // =====================================================
    // 1. GET INPUT
    // =====================================================

    const item = req.data.item;

    if (!item) {
        return req.reject(400, "MTO input is required");
    }

    const mtoModelCode = item.mtoModelCode;
    const regionCode = item.regionCode;

    const approvedMTSNSP =
        Number(item.approvedMTSNSP || 0);

    const approvedMTSExShowroom =
        Number(item.approvedMTSExShowroom || 0);

    const approvedMTSOnRoad =
        Number(item.approvedMTSOnRoad || 0);


    if (!mtoModelCode) {
        return req.reject(400, "MTO Model Code is required");
    }

    if (!regionCode) {
        return req.reject(400, "Region Code is required");
    }

    if (approvedMTSNSP <= 0) {
        return req.reject(400, "Approved MTS NSP is required");
    }

    if (approvedMTSExShowroom <= 0) {
        return req.reject(
            400,
            "Approved MTS Ex-Showroom price is required"
        );
    }


    // =====================================================
    // 2. GET MTO CONFIGURATION
    // =====================================================

    const configuration = await SELECT.one
        .from(MTOConfigurations)
        .where({
            mtoModelCode: mtoModelCode
        });

    if (!configuration) {
        return req.reject(
            404,
            `MTO configuration ${mtoModelCode} not found`
        );
    }


    // =====================================================
    // 3. GET REFERENCE MTS MODEL
    // =====================================================

    const referenceMTSModel =
        configuration.referenceMTSModel_modelCode;

    if (!referenceMTSModel) {
        return req.reject(
            400,
            `Reference MTS model not maintained for ${mtoModelCode}`
        );
    }


    // =====================================================
    // 4. CHECK MTS MODEL
    // =====================================================

    const mtsModel = await SELECT.one
        .from(Models)
        .where({
            modelCode: referenceMTSModel
        });

    if (!mtsModel) {
        return req.reject(
            404,
            `Reference MTS model ${referenceMTSModel} not found`
        );
    }


    // =====================================================
    // 5. GET MTO CONFIGURATION PARTS
    // =====================================================

    const configurationParts = await SELECT
        .from(MTOConfigurationParts)
        .where({
            configuration_mtoModelCode: mtoModelCode
        });

    if (!configurationParts.length) {
        return req.reject(
            400,
            `No parts configured for ${mtoModelCode}`
        );
    }


    // =====================================================
    // 6. CALCULATE MIY
    // =====================================================

    let miyExShowroomTotal = 0;
    let miyOnRoadTotal = 0;
    let incrementDealer = 0;


    for (const configPart of configurationParts) {

        const partCode =
            configPart.part_partCode;

        const quantity =
            Number(configPart.quantity || 0);


        if (!partCode) {
            return req.reject(
                400,
                `Part not maintained for part number ${configPart.partNo}`
            );
        }

        if (quantity <= 0) {
            return req.reject(
                400,
                `Invalid quantity for part ${partCode}`
            );
        }


        // -------------------------------------------------
        // GET PART MASTER
        // -------------------------------------------------

        const part = await SELECT.one
            .from(Parts)
            .where({
                partCode: partCode
            });

        if (!part) {
            return req.reject(
                404,
                `Part ${partCode} not found`
            );
        }


        const miyCost =
            Number(part.miyCost || 0);

        const miyMarkup =
            Number(part.miyMarkup || 0);

        const totalMIY =
            miyCost * quantity;


        const priceIndicator =
            String(part.priceIndicator || "")
                .trim()
                .toUpperCase();


        // -------------------------------------------------
        // EX-SHOWROOM PART
        // -------------------------------------------------

        if (priceIndicator === "EXSHOWROOM") {

            miyExShowroomTotal +=
                totalMIY;
        }


        // -------------------------------------------------
        // ON-ROAD PART
        // -------------------------------------------------

        else if (priceIndicator === "ONROAD") {

            miyOnRoadTotal +=
                totalMIY;
        }


        // -------------------------------------------------
        // DEALER MARKUP
        // -------------------------------------------------

        incrementDealer +=
            miyMarkup * quantity;
    }


    // =====================================================
    // 7. CALCULATE EXPECTED MTO PRICE
    // =====================================================

    const expectedExShowroom =
        approvedMTSExShowroom +
        miyExShowroomTotal;


    const expectedOnRoad =
        approvedMTSOnRoad +
        miyExShowroomTotal +
        miyOnRoadTotal;


    // =====================================================
    // 8. GOAL SEEK
    //
    // Start from APPROVED MTS NSP.
    //
    // The existing mts.js is called repeatedly.
    // mts.js is NOT modified.
    // =====================================================

    let trialNSP =
        approvedMTSNSP;

    let finalMTSCalculation = null;

    const maxIterations = 100000;


    for (
        let iteration = 1;
        iteration <= maxIterations;
        iteration++
    ) {

        const mtsCalculation =
            await calculateMTS({
                data: {
                    item: {
                        modelCode: referenceMTSModel,
                        nsp: trialNSP,
                        regionCode: regionCode
                    }
                }
            });


        if (!mtsCalculation) {
            return req.reject(
                400,
                "MTS calculation returned no result"
            );
        }


        const calculatedExShowroom =
            Number(
                mtsCalculation.exShowroomPrice || 0
            );


        if (calculatedExShowroom <= 0) {
            return req.reject(
                400,
                "MTS calculation returned invalid Ex-Showroom price"
            );
        }


        // -------------------------------------------------
        // TARGET REACHED
        // -------------------------------------------------

        const difference =
            expectedExShowroom -
            calculatedExShowroom;


        if (Math.abs(difference) <= 1) {

            finalMTSCalculation =
                mtsCalculation;

            break;
        }


        // -------------------------------------------------
        // INCREASE NSP
        // -------------------------------------------------

        if (difference > 0) {

            trialNSP =
                trialNSP + 1;

        }

        // -------------------------------------------------
        // DECREASE NSP
        // -------------------------------------------------

        else {

            trialNSP =
                trialNSP - 1;
        }


        if (trialNSP <= 0) {
            return req.reject(
                400,
                "Goal Seek resulted in invalid NSP"
            );
        }
    }


    // =====================================================
    // 9. CHECK GOAL SEEK
    // =====================================================

    if (!finalMTSCalculation) {
        return req.reject(
            400,
            `Goal Seek could not reach target Ex-Showroom ₹${expectedExShowroom}`
        );
    }


    // =====================================================
    // 10. FINAL MTO NSP
    // =====================================================

    const mtoNSP =
        Number(
            finalMTSCalculation.actualNSP ??
            trialNSP
        );


    // =====================================================
    // 11. FINAL MTO EX-SHOWROOM
    // =====================================================

    const mtoExShowroom =
        Number(
            finalMTSCalculation.exShowroomPrice
        );


    // =====================================================
    // 12. FINAL MTO ON-ROAD
    // =====================================================

    const mtoOnRoad =
        expectedOnRoad;


    // =====================================================
    // 13. RETURN RESULT
    // =====================================================

    return {

        mtoModelCode:
            mtoModelCode,

        referenceMTSModel:
            referenceMTSModel,

        regionCode:
            regionCode,


        // APPROVED MTS INPUT
        mtsNSP:
            Number(approvedMTSNSP.toFixed(2)),

        mtsExShowroom:
            Number(approvedMTSExShowroom.toFixed(2)),

        mtsOnRoad:
            Number(approvedMTSOnRoad.toFixed(2)),


        // MIY
        miyExShowroomTotal:
            Number(miyExShowroomTotal.toFixed(2)),

        miyOnRoadTotal:
            Number(miyOnRoadTotal.toFixed(2)),


        // EXPECTED MTO
        expectedExShowroom:
            Number(expectedExShowroom.toFixed(2)),

        expectedOnRoad:
            Number(expectedOnRoad.toFixed(2)),


        // FINAL MTO
        mtoNSP:
            Number(mtoNSP.toFixed(2)),

        mtoExShowroom:
            Number(mtoExShowroom.toFixed(2)),

        mtoOnRoad:
            Number(mtoOnRoad.toFixed(2)),


        // DEALER
        incrementDealer:
            Number(incrementDealer.toFixed(2))
    };
}


module.exports = {
    calculateMTO
};