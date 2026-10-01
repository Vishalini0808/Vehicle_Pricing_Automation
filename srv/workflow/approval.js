const cds = require("@sap/cds");
const { SELECT, UPDATE } = cds.ql;

async function decide(req, newStatus) {

    const { referenceNumber, comments } = req.data;
    const { PricingResults, Submissions } = cds.entities("vehicle.db");
    const tx = cds.tx(req);

    // 1. Validate input
    if (!referenceNumber) {
        return req.reject(400, "Reference number is required");
    }
    if (newStatus === "REJECTED" && !comments) {
        return req.reject(400, "Comments are required when rejecting");
    }

    // 2. Find the submission
    const submission = await tx.run(
        SELECT.one.from(Submissions).where({ referenceNumber })
    );
    if (!submission) {
        return req.reject(404, `Submission ${referenceNumber} not found`);
    }

    // 3. Only SUBMITTED can be approved or rejected
    if (submission.status !== "SUBMITTED") {
        return req.reject(
            409,
            `Submission ${referenceNumber} is ${submission.status}; only SUBMITTED can be ${newStatus.toLowerCase()}`
        );
    }


    // 4. Update the submission header (keep the submitter's comment, append the decision)
    const note = comments ? `${submission.comments ? submission.comments + " | " : ""}${newStatus}: ${comments}` : submission.comments;

    await tx.run(
        UPDATE(Submissions)
            .set({ status: newStatus, comments: note?.slice(0, 1000) })
            .where({ ID: submission.ID })
    );

    // 5. Update every pricing line in that submission
    const lines = await tx.run(
        UPDATE(PricingResults)
            .set({ status: newStatus })
            .where({ submission_ID: submission.ID })
    );

    return { referenceNumber, status: newStatus, lines };
}

const approvePricing = (req) => decide(req, "APPROVED");
const rejectPricing  = (req) => decide(req, "REJECTED");

module.exports = { approvePricing, rejectPricing };