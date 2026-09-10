namespace vehicle.db;

type MasterStatus   : String enum {
    ACTIVE;
    INACTIVE;
}

type ApprovalStatus : String enum {
    DRAFT;
    SUBMITTED;
    APPROVED;
    REJECTED;
}

entity Regions {
    key regionCode : String(10);
        regionName : String(100);
        rtoBasis   : String(20); //rto price
}


type engineType     : String enum {
    Petrol;
    Diesel;
    EV
};

entity Models {
    key modelCode           : String(40);
        validFrom           : Date; // Date from which this pricing is effective
        nspPrice            : Decimal(15, 2); // Main vehicle base price / NSP

        modelDescription    : String(200); // vehicle desc
        engineType          : engineType default 'Petrol'; // petrol/diesel/ev
        ccWatt              : Decimal(10, 2); // Engine CC for fuel vehichels / electric watt for EV

        gstPercent          : Decimal(5, 2); // GST calculation
        dealerMarginPercent : Decimal(5, 2); // Dealer margin calculation

        csdDiscountPercent  : Decimal(5, 2); // Discount percentage applicable for CSD customers
        csdGstPercent       : Decimal(5, 2); // GST percentage applicable to CSD pricing
        gemValue            : Decimal(15, 2); // Value used for GEM pricing/calculation

        status              : MasterStatus default 'ACTIVE'; // Whether the model is active or inactive
        approvalStatus      : ApprovalStatus default 'DRAFT'; // Approval status of the model data
}

entity PricingComponents {

    key regionCode            : String(10); // Region for which these pricing components apply
    key engineType            : engineType default 'Petrol'; // Engine type for which the pricing applies
        validFrom             : Date; // Date from which these pricing values are effective

        helmet                : Decimal(15, 2); // Helmet charge included in the vehicle price
        transportation        : Decimal(15, 2); // Transportation/logistics charge
        helmetMargin          : Decimal(15, 2); // Margin added to the helmet cost

        otherExpensesBelow500 : Decimal(15, 2); // Other expenses for vehicles below 500 CC
        otherExpensesAbove500 : Decimal(15, 2); // Other expenses for vehicles above 500 CC

        insuranceRateBelow350 : Decimal(7, 4); // Insurance rate for vehicles below 350 CC
        insuranceRateAbove350 : Decimal(7, 4); // Insurance rate for vehicles above 350 CC

        tpaPaBelow350         : Decimal(15, 2); // TPA/PA charge for vehicles below 350 CC
        tpaPaAbove350         : Decimal(15, 2); // TPA/PA charge for vehicles above 350 CC

        noPlateCharges        : Decimal(15, 2); // Number plate charges

        approvalStatus        : ApprovalStatus default 'DRAFT';
}

entity RTOMasters {
    key id             : UUID;
        region         : Association to Regions;
        validFrom      : Date; // Date from which this RTO rule is effective

        slab           : Integer; // RTO slab/category number
        engineType     : engineType default 'Petrol'; // Engine type to which the RTO rule applies

        ccMin          : Decimal(10, 2); // Minimum engine CC covered by this slab
        ccMax          : Decimal(10, 2); // Maximum engine CC covered by this slab

        minimumPrice   : Decimal(15, 2); // Minimum vehicle price covered by this RTO rule
        maximumPrice   : Decimal(15, 2); // Maximum vehicle price covered by this RTO rule

        rtoPercent     : Decimal(7, 4); // RTO percentage applied to the vehicle price
        flatPriceValue : Decimal(15, 2); // Fixed RTO amount when flat pricing is applicable

        approvalStatus : ApprovalStatus default 'DRAFT';
}


entity RTOExpense {
    key id             : UUID; // Unique ID for the RTO expense record
        region         : Association to Regions; // Region/state to which the expense applies
        slab           : Integer; // RTO expense slab/category

        minimumPrice   : Decimal(15, 2); // Minimum vehicle price for this expense range
        maximumPrice   : Decimal(15, 2); // Maximum vehicle price for this expense range

        percentage     : Decimal(7, 4); // Expense percentage applied to the vehicle price
        fixedAmount    : Decimal(15, 2); // Fixed expense amount when applicable


        approvalStatus : ApprovalStatus default 'DRAFT';
}


entity Parts {
    key partCode       : String(50); // Unique code identifying the part
        validFrom      : Date; // Date from which the part pricing is effective
        description    : String(200); // Description/name of the part

        miyCost        : Decimal(15, 2); // Base MIY cost of the part
        miyMarkup      : Decimal(15, 2); // Markup added to the MIY cost

        priceIndicator : String(20); // Indicates how the part price should be handled
};


entity MTOConfigurations {
    key mtoModelCode      : String(40);
        validFrom         : Date; // Date from which the part pricing is effective

        referenceMTSModel : Association to Models; // Standard MTS model used as the base/reference

        parts             : Composition of many MTOConfigurationParts
                                on parts.configuration = $self; // Parts belonging to this MTO configuration
};


entity MTOConfigurationParts {
    key partNo        : Integer;
        configuration : Association to MTOConfigurations; // MTO configuration this part belongs to
        part          : Association to Parts; // Part selected for this configuration
        quantity      : Integer; // Quantity of this part required
};


entity PricingResults {

    key ID                  : UUID; // Unique ID for each pricing result


        /* References */

        model               : Association to Models; // Vehicle model for which pricing is calculated

        region              : Association to Regions; // Region/state for which pricing is calculated

        orderType           : String(10); // Type of pricing: MTS / MTO / EV / GEM / CSD

        submission          : Association to Submissions; // Submission/request associated with this pricing calculation


        /* Input */

        inputNSP            : Decimal(15, 2); // NSP entered by the user for bottom-up pricing

        exShowroomInput     : Decimal(15, 2); // Target Ex-Showroom entered by the user for reverse/top-down pricing


        /* MTS */

        actualNSP           : Decimal(15, 2); // Final NSP used for the MTS calculation

        helmet              : Decimal(15, 2); // Helmet cost included in Dealer Cost

        transportation      : Decimal(15, 2); // Transportation/logistics cost included in Dealer Cost

        dealerCost          : Decimal(15, 2); // Dealer Cost = NSP + Helmet + Transportation

        otherExpenses       : Decimal(15, 2); // Other expenses based on the applicable CC slab

        dealerMargin        : Decimal(15, 2); // Dealer margin amount calculated using the configured margin percentage

        helmetMargin        : Decimal(15, 2); // Margin added to the helmet cost

        totalDealerMargin   : Decimal(15, 2); // Total Dealer Margin = Dealer Margin + Helmet Margin

        ndp                 : Decimal(15, 2); // Net Dealer Price = Dealer Cost × (1 + GST %)

        basicPrice          : Decimal(15, 2); // Basic taxable vehicle price before GST

        gstAmount           : Decimal(15, 2); // GST amount calculated on the Basic Price

        exShowroomPrice     : Decimal(15, 2); // Final Ex-Showroom Price = Basic Price + GST Amount


        /* RTO */

        rtoPercent          : Decimal(7, 4); // RTO percentage obtained from the applicable RTO Master slab

        rtoAmount           : Decimal(15, 2); // RTO amount calculated based on region basis and applicable RTO rule

        rtoWithBill         : Decimal(15, 2); // RTO With Bill amount obtained from RTO Expense/configuration


        /* Insurance */

        insuranceRate       : Decimal(7, 4); // Insurance rate applicable to the vehicle's CC band

        insuranceAmount     : Decimal(15, 2); // Insurance amount calculated using Ex-Showroom and applicable insurance rate

        tpaPa               : Decimal(15, 2); // TPA/PA charge applicable to the vehicle

        insuranceGst        : Decimal(15, 2); // GST calculated on Insurance Amount + TPA/PA

        totalInsurance      : Decimal(15, 2); // Total Insurance = Insurance Amount + TPA/PA + Insurance GST

        onRoadPrice         : Decimal(15, 2); // Final On-Road Price = Ex-Showroom + RTO + RTO With Bill + Total Insurance


        /* MTO */

        referenceMTSModel   : Association to Models; // Approved MTS model used as the reference for MTO pricing

        mtsExShowroom       : Decimal(15, 2); // Ex-Showroom price of the reference MTS model

        mtsOnRoad           : Decimal(15, 2); // On-Road price of the reference MTS model

        miyExShowroomTotal  : Decimal(15, 2); // Total MIY cost of parts that increase the Ex-Showroom price

        miyOnRoadTotal      : Decimal(15, 2); // Total MIY cost of parts that increase only the On-Road price

        expectedExShowroom  : Decimal(15, 2); // Expected MTO Ex-Showroom = MTS Ex-Showroom + applicable MIY costs

        expectedOnRoad      : Decimal(15, 2); // Expected MTO On-Road = MTS On-Road + applicable MIY costs

        incrementDealer     : Decimal(15, 2); // Additional dealer margin from the MIY markup of fitted MTO parts


        /* GeM */

        lowestMtsExShowroom : Decimal(15, 2); // Lowest approved MTS Ex-Showroom price across all regions

        gemDiscountPercent  : Decimal(7, 4); // GeM discount percentage, normally 12%

        gemDiscountAmount   : Decimal(15, 2); // GeM Discount Amount = Lowest MTS Ex-Showroom × GeM Discount %

        gemSubTotal         : Decimal(15, 2); // GeM Sub-Total = Lowest MTS Ex-Showroom - GeM Discount Amount

        gemBasic            : Decimal(15, 2); // GST-exclusive GeM price = GeM Sub-Total ÷ (1 + GST %)

        gemGstAmount        : Decimal(15, 2); // GST amount backed out from the GeM Sub-Total

        finalGemPrice       : Decimal(15, 2); // Final GeM Price after applying the GeM discount


        /* CSD */

        csdNsp              : Decimal(15, 2); // CSD NSP = MTS Actual NSP + Transportation + Other Expenses + Total Dealer Margin

        csdBasicExclHelmet  : Decimal(15, 2); // MTS Basic Price excluding Helmet and Helmet Margin

        csdDiscountPercent  : Decimal(7, 4); // CSD discount percentage configured for the model

        csdDiscountAmount   : Decimal(15, 2); // CSD Discount Amount = CSD NSP × CSD Discount %

        csdPreTaxNet        : Decimal(15, 2); // Pre-Tax Net = Basic Price excluding Helmet - CSD Discount Amount

        csdGstPercent       : Decimal(7, 4); // GST percentage applicable specifically to CSD pricing

        csdGstAmount        : Decimal(15, 2); // CSD GST Amount = Pre-Tax Net × CSD GST %

        csdExShowroom       : Decimal(15, 2); // CSD Ex-Showroom = Pre-Tax Net + CSD GST Amount

        incidentalPercent   : Decimal(7, 4); // Incidental charge percentage, normally 1%

        incidentalCharges   : Decimal(15, 2); // Incidental Charges = Pre-Tax Net × Incidental %

        finalCsdPrice       : Decimal(15, 2); // Final CSD Price = CSD Ex-Showroom + Incidental Charges

        csdOnRoad           : Decimal(15, 2); // CSD On-Road = CSD Ex-Showroom + RTO + RTO With Bill + Total Insurance


        /* Approval */

        status              : ApprovalStatus; // Approval status of the pricing result: DRAFT / SUBMITTED / APPROVED / REJECTED
}

entity Submissions {
    key ID              : UUID;
        referenceNumber : String(30); // Business reference number for tracking the request
        submitterEmail  : String(150);

        status          : ApprovalStatus default 'SUBMITTED';
        comments        : String(1000);
}

// entity ApprovalHistory {

//     key ID : UUID;
//     referenceNumber : Association to Submissions ;                     // Reference number of the related submission

//     // action : ApprovalStatus ;
//     actionOn : Timestamp;
//     comments : String(1000);
// }
