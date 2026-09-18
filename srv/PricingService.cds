using vehicle.db as db from '../db/vehicle-pricing-schema';
 
@path: '/pricing'
service PricingService {
 
    entity Regions
        as projection on db.Regions;
 
    entity Models
        as projection on db.Models;
 
    entity PricingComponents
        as projection on db.PricingComponents;
 
    entity RTOMasters
        as projection on db.RTOMasters;
 
    entity RTOExpense
        as projection on db.RTOExpense;
 
    entity Parts
        as projection on db.Parts;
 
    entity MTOConfigurations
        as projection on db.MTOConfigurations;
 
    entity MTOConfigurationParts
        as projection on db.MTOConfigurationParts;
 entity PricingResults
        as projection on db.PricingResults;


//--------mts----------

type MTSResult {
    NSP               : Decimal(15,2);
    dealerCost        : Decimal(15,2);
    NDP               : Decimal(15,2);
    dealerMargin      : Decimal(15,2);
    totalDealerMargin : Decimal(15,2);
    otherExpenses     : Decimal(15,2);
    basicPrice        : Decimal(15,2);
    gstAmount         : Decimal(15,2);
    exShowroomPrice   : Decimal(15,2);
    rtoAmount         : Decimal(15,2);
    rtoWithBill       : Decimal(15,2);
    insuranceAmount   : Decimal(15,2);
    tpaPa             : Decimal(15,2);
    insuranceGst      : Decimal(15,2);
    totalInsurance    : Decimal(15,2);
    onRoadPrice       : Decimal(15,2);
}

action calculateMTS( NSP : Decimal(15,2), regionCode : String(20), engineType : String(20), modelCode  : String(20)) returns MTSResult;


//---------------mto----------------------
type MTOPartInput {
    partCode : String(50);
    quantity : Integer;
}

type MTOInput {
    modelCode  : String(40);
    regionCode : String(20);
    engineType : String(20);
    orderType  : String(10);
    validFrom  : Date;
    parts      : many MTOPartInput;
}

type MTOResult {
    modelCode           : String(40);
    mtoModelCode        : String(40);
    regionCode          : String(20);
    engineType          : String(20);
    orderType           : String(10);

    referenceMTSModel   : String(40);

    mtsNSP              : Decimal(15,2);
    mtsExShowroom       : Decimal(15,2);
    mtsOnRoad           : Decimal(15,2);

    miyExShowroomTotal  : Decimal(15,2);
    miyOnRoadTotal      : Decimal(15,2);

    expectedExShowroom  : Decimal(15,2);
    expectedOnRoad      : Decimal(15,2);

    actualNSP           : Decimal(15,2);
    exShowroomPrice     : Decimal(15,2);
    onRoadPrice         : Decimal(15,2);

    incrementDealer     : Decimal(15,2);
    iterations          : Integer;
}

action calculateMTO( items : many MTOInput ) returns many MTOResult;


//---------------------ev---------------------------
type EVInput {
    modelCode  : String(40);
    nsp        : Decimal(15,2);
    regionCode : String(10);
}

type EVResult {
    modelCode           : String(40);
    regionCode          : String(10);
    engineType          : String(10);

    nsp                  : Decimal(15,2);
    transportation       : Decimal(15,2);
    otherExpenses        : Decimal(15,2);
    dealerMargin         : Decimal(15,2);

    basicPrice           : Decimal(15,2);
    gstAmount            : Decimal(15,2);
    exShowroomPrice      : Decimal(15,2);

    rtoAmount            : Decimal(15,2);
    insurance            : Decimal(15,2);
    tpaPA                : Decimal(15,2);
    numberPlateCharges   : Decimal(15,2);

    onRoadPrice          : Decimal(15,2);
}

action calculateEV(item : EVInput) returns EVResult;


//--------------------------gem----------------------------
   
   action calculateGeM(modelCodes: many String(20));

    action calculateCSD();

    action calculateMultiRegion();

    action submitPricing();

    action approvePricing();

    action rejectPricing();


 
}