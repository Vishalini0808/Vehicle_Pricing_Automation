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

    const updateMasterStatus = async (req, newStatus) => {

      const { entityName, recordKey } = req.data;

      const entity = this.entities[entityName];

      if (!entity) {
        return req.reject(400, "Entity not found");
      }

      // Dynamically identify approval field
      const statusField =
        (entity.elements.approvalStatus && "approvalStatus") ||
        (entity.elements.status && "status");

      if (!statusField) {
        return req.reject(400, "Status field not found");
      }

      // Parse primary key
      let key;

      try {
        key = JSON.parse(recordKey);
      } catch (error) {
        return req.reject(400, "Invalid record key");
      }

      if (!key || typeof key !== "object" || Array.isArray(key)) {
        return req.reject(400, "Invalid record key");
      }

      // Validate exact primary key fields
      const expectedKeys = Object.keys(entity.keys);

      if (
        Object.keys(key).length !== expectedKeys.length ||
        !expectedKeys.every(
          field =>
            Object.prototype.hasOwnProperty.call(key, field) &&
            key[field] !== null &&
            key[field] !== undefined
        )
      ) {
        return req.reject(400, "Invalid primary key fields");
      }

      const tx = cds.tx(req);

      // Update only submitted records
      const updated = await tx.run(
        UPDATE(entity)
          .set({
            [statusField]: newStatus
          })
          .where({
            ...key,
            [statusField]: "SUBMITTED"
          })
      );

      if (updated !== 1) {
        return req.reject(
          409,
          "Record not found or not in SUBMITTED status"
        );
      }

      return true;
    };

    this.on("approveMaster", async (req) => {
      return updateMasterStatus(req, "APPROVED");
    });

    this.on("rejectMaster", async (req) => {
      return updateMasterStatus(req, "REJECTED");
    });

    return super.init();
  }
};