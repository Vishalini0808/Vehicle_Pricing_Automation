namespace vehicle.db ;

type MasterStatus : String enum {
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
    key  regionCode     : String(10);
    regionName     : String(100);
    rtoBasis       : String(20);                  //rto price
}
 

type engineType : String enum { Petrol; Diesel; EV};

entity Models {
   key  modelCode : String(40);
    validFrom : Date;                             // Date from which this pricing is effective
    nspPrice:Decimal(15,2);                       // Main vehicle base price / NSP

    modelDescription : String(200);               // vehicle desc
    engineType : engineType default 'Petrol';     // petrol/diesel/ev
    ccWatt : Decimal(10,2);                       // Engine CC for fuel vehichels / electric watt for EV

    gstPercent : Decimal(5,2);                    // GST calculation
    dealerMarginPercent : Decimal(5,2);           // Dealer margin calculation

    csdDiscountPercent : Decimal(5,2);            // Discount percentage applicable for CSD customers
    csdGstPercent : Decimal(5,2);                 // GST percentage applicable to CSD pricing
    gemValue : Decimal(15,2);                     // Value used for GEM pricing/calculation

    status : MasterStatus default 'ACTIVE';           // Whether the model is active or inactive
    approvalStatus : ApprovalStatus default 'DRAFT';  // Approval status of the model data
}
 
entity PricingComponents {
 
    key regionCode          : String(10);             // Region for which these pricing components apply
    key engineType              : engineType default 'Petrol';       // Engine type for which the pricing applies
    validFrom               : Date;                   // Date from which these pricing values are effective

    helmet                  : Decimal(15,2);          // Helmet charge included in the vehicle price
    transportation          : Decimal(15,2);          // Transportation/logistics charge
    helmetMargin            : Decimal(15,2);          // Margin added to the helmet cost

    otherExpensesBelow500   : Decimal(15,2);          // Other expenses for vehicles below 500 CC
    otherExpensesAbove500   : Decimal(15,2);          // Other expenses for vehicles above 500 CC

    insuranceRateBelow350   : Decimal(7,4);           // Insurance rate for vehicles below 350 CC
    insuranceRateAbove350   : Decimal(7,4);           // Insurance rate for vehicles above 350 CC

    tpaPaBelow350           : Decimal(15,2);          // TPA/PA charge for vehicles below 350 CC
    tpaPaAbove350           : Decimal(15,2);          // TPA/PA charge for vehicles above 350 CC

    noPlateCharges          : Decimal(15,2);          // Number plate charges

    approvalStatus : ApprovalStatus default 'DRAFT';
}
 
entity RTOMasters {
    key id               : UUID;
    region               : Association to Regions;
    validFrom            : Date;                      // Date from which this RTO rule is effective

    slab                 : Integer;                   // RTO slab/category number
    engineType           : engineType default 'Petrol';   // Engine type to which the RTO rule applies

    ccMin                : Decimal(10,2);             // Minimum engine CC covered by this slab
    ccMax                : Decimal(10,2);             // Maximum engine CC covered by this slab

    minimumPrice         : Decimal(15,2);             // Minimum vehicle price covered by this RTO rule
    maximumPrice         : Decimal(15,2);             // Maximum vehicle price covered by this RTO rule

    rtoPercent           : Decimal(7,4);              // RTO percentage applied to the vehicle price
    flatPriceValue       : Decimal(15,2);             // Fixed RTO amount when flat pricing is applicable

    approvalStatus       : ApprovalStatus default 'DRAFT' ;
}


entity RTOExpense {
    key id          : UUID;                            // Unique ID for the RTO expense record
    region          : Association to Regions;          // Region/state to which the expense applies
    slab            : Integer;                         // RTO expense slab/category

    minimumPrice    : Decimal(15,2);                   // Minimum vehicle price for this expense range
    maximumPrice    : Decimal(15,2);                   // Maximum vehicle price for this expense range

    percentage      : Decimal(7,4);                    // Expense percentage applied to the vehicle price
    fixedAmount     : Decimal(15,2);                   // Fixed expense amount when applicable


    approvalStatus        : ApprovalStatus default 'DRAFT';
}


entity Parts {
    key partCode     : String(50);                     // Unique code identifying the part
    validFrom        : Date;                           // Date from which the part pricing is effective
    description      : String(200);                    // Description/name of the part

    miyCost          : Decimal(15,2);                  // Base MIY cost of the part
    miyMarkup        : Decimal(15,2);                  // Markup added to the MIY cost

    priceIndicator   : String(20);                     // Indicates how the part price should be handled
};


entity MTOConfigurations {
    key mtoModelCode   : String(40);
    validFrom          : Date;                         // Date from which the part pricing is effective

    referenceMTSModel  : Association to Models;        // Standard MTS model used as the base/reference
    
    parts : Composition of many MTOConfigurationParts on parts.configuration = $self;   // Parts belonging to this MTO configuration
};


entity MTOConfigurationParts {
    key partNo          : Integer;
    configuration       : Association to MTOConfigurations;  // MTO configuration this part belongs to
    part                : Association to Parts;              // Part selected for this configuration
    quantity            : Integer;                           // Quantity of this part required
};

 
entity Submissions {
    key ID              : UUID;
    referenceNumber     : String(30);                 // Business reference number for tracking the request
    submitterEmail      : String(150);                

    status              : ApprovalStatus default 'SUBMITTED'; 
    comments            : String(1000);
}
 
// entity ApprovalHistory {
 
//     key ID : UUID;
//     referenceNumber : Association to Submissions ;                     // Reference number of the related submission

//     // action : ApprovalStatus ; 
//     actionOn : Timestamp;
//     comments : String(1000);
// }

