const cds = require("@sap/cds");

const { SELECT } = cds.ql;

module.exports = async function (req, srv) {

    const input = req.data.input || req.data;

    const { modelCodes, regionCodes, orderType } = input;

    const allowedOrderTypes = ["MTS", "MTO", "EV", "CSD"];

    if (!Array.isArray(modelCodes) || modelCodes.length === 0) {
        return req.reject(400, "Select at least one model.");
    }

    if (!Array.isArray(regionCodes) || regionCodes.length === 0) {
        return req.reject(400, "Select at least one region.");
    }

    if (!allowedOrderTypes.includes(orderType)) {
        return req.reject(
            400,
            "Supported order types are MTS, MTO, EV, and CSD."
        );
    }

    const { Models, PricingResults } = srv.entities;

    const results = [];

    for (const modelCode of modelCodes) {

        // ---------------------------------------------------------
        // 1. Get Model
        // ---------------------------------------------------------
        const model = await SELECT.one
            .from(Models)
            .where({ modelCode });

        if (!model) {
            return req.reject(
                404,
                `Model ${modelCode} was not found.`
            );
        }

        // ---------------------------------------------------------
        // 2. Determine the TN base pricing type
        // ---------------------------------------------------------
        const baseOrderType =
            orderType === "EV" ? "EV" : "MTS";

        // ---------------------------------------------------------
        // 3. Get TN pricing result
        // ---------------------------------------------------------
        const baseResult = await SELECT.one
            .from(PricingResults)
            .columns(
                "ID",
                "actualNSP",
                "inputNSP",
                "nspPrice",
                "status"
            )
            .where({
                model_modelCode: modelCode,
                region_regionCode: "TN01",
                orderType: baseOrderType
            });

        if (!baseResult) {
            return req.reject(
                400,
                `Calculate Tamil Nadu ${baseOrderType} pricing first for ${modelCode}.`
            );
        }

        // ---------------------------------------------------------
        // 4. Get NSP from TN pricing
        // ---------------------------------------------------------
        const tnNSP =
            baseResult.inputNSP ??
            baseResult.actualNSP ??
            baseResult.nspPrice;

        if (tnNSP == null) {
            return req.reject(
                400,
                `Tamil Nadu NSP is missing for ${modelCode}.`
            );
        }

        // ---------------------------------------------------------
        // 5. Calculate selected regions
        // ---------------------------------------------------------
        for (const regionCode of regionCodes) {

            let result;

            switch (orderType) {

                // =================================================
                // MTS
                // =================================================
                case "MTS":

                    result = await srv.send("calculateMTS", {
                        NSP: tnNSP,
                        regionCode,
                        engineType: model.engineType,
                        modelCode
                    });

                    break;

                // =================================================
                // EV
                // =================================================
                case "EV":

                    result = await srv.send("calculateEV", {
                        item: {
                            modelCode,
                            nsp: tnNSP,
                            regionCode
                        }
                    });

                    break;

                // =================================================
                // CSD
                // =================================================
                case "CSD":

                    result = await srv.send("calculateCSD", {
                        modelCode: [modelCode],
                        regionCode
                    });

                    break;

                // =================================================
                // MTO
                // =================================================
                case "MTO":

                    return req.reject(
                        400,
                        "MTO requires the configured parts for each model. " +
                        "Load the MTO configuration and its parts before " +
                        "dispatching calculateMTO."
                    );
            }

            // -----------------------------------------------------
            // 6. Normalize result
            // -----------------------------------------------------
            const rows = Array.isArray(result)
                ? result
                : [result];

            for (const row of rows) {

                if (!row) {
                    continue;
                }

                results.push({
                    ID: row.ID,
                    modelCode: row.modelCode || modelCode,
                    regionCode: row.regionCode || regionCode,
                    orderType,
                    actualNSP: row.actualNSP ?? row.NSP ?? row.nsp,
                    exShowroomPrice: row.exShowroomPrice,
                    onRoadPrice: row.onRoadPrice,
                    status: row.status || "DRAFT"
                });
            }
        }
    }

    return results;
};