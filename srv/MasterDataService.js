const cds = require("@sap/cds");

module.exports = class MasterService extends cds.ApplicationService {
  init() {
    const { Models } = cds.entities("vehicle.db");
    const { MTOConfigurations, MTOConfigurationParts } = this.entities;

    this.before(["CREATE", "UPDATE"], MTOConfigurations, async (req) => {
      const { mtoModelCode, referenceMTSModel_modelCode: sMts } = req.data;

      if (req.event === "CREATE") {
        const oMto = await SELECT.one.from(Models).columns("orderType").where({ modelCode: mtoModelCode });
        if (!oMto || oMto.orderType !== "MTO") {
          req.error(400, `${mtoModelCode} is not a valid MTO model`, "mtoModelCode");
        }
      }
      if (sMts) {
        const oMts = await SELECT.one.from(Models).columns("orderType").where({ modelCode: sMts });
        if (!oMts || oMts.orderType !== "MTS") {
          req.error(400, `${sMts} is not a valid MTS model`, "referenceMTSModel_modelCode");
        }
      }
    });

    this.before(["CREATE", "UPDATE"], MTOConfigurationParts, (req) => {
      const { event, data } = req;
      if ((event === "CREATE" || "part_partCode" in data) && !data.part_partCode) {
        req.error(400, "Part is required", "part_partCode");
      }
      if ((event === "CREATE" || "quantity" in data) && !(Number(data.quantity) > 0)) {
        req.error(400, "Quantity must be greater than 0", "quantity");
      }
    });

    return super.init();
  }
};