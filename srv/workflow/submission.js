const cds = require("@sap/cds");
const { SELECT, INSERT, UPDATE } = cds.ql;

async function nextReferenceNumber(tx) {
    const { Submissions } = cds.entities("vehicle.db");
    const last = await tx.run(
        SELECT.one.from(Submissions)
            .columns("referenceNumber")
            .where("referenceNumber like 'REF%'")
            .orderBy("referenceNumber desc")
    );
    const n = last ? parseInt(last.referenceNumber.slice(3), 10) + 1 : 1;
    return "REF" + String(n).padStart(7, "0");        // REF0001234
}

async function submitPricing(req) {
    const { resultIDs, comments } = req.data;
    const { PricingResults, Submissions } = cds.entities("vehicle.db");

    if (!resultIDs?.length) return req.reject(400, "Select at least one line to submit");

    const tx = cds.tx(req);

    const rows = await tx.run(
        SELECT.from(PricingResults).columns("ID", "status", "submission_ID").where({ ID: { in: resultIDs } })
    );
    if (rows.length !== resultIDs.length) return req.reject(404, "Some lines were not found");

    const notDraft = rows.filter(r => r.status !== "DRAFT");
    if (notDraft.length) return req.reject(409, `${notDraft.length} line(s) are not in DRAFT status`);

    const ID = cds.utils.uuid();
    const referenceNumber = await nextReferenceNumber(tx);

    await tx.run(INSERT.into(Submissions).entries({
        ID,
        referenceNumber,
        submitterEmail: req.user.attr?.email || req.user.id,
        status: "SUBMITTED",
        comments
    }));

    await tx.run(
        UPDATE(PricingResults)
            .set({ status: "SUBMITTED", submission_ID: ID })
            .where({ ID: { in: resultIDs } })
    );

    return { referenceNumber, status: "SUBMITTED", lines: rows.length };
}

module.exports = { submitPricing };