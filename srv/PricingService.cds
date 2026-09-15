using vehicle.db as db from '../db/vehicle-pricing-schema';
 
//@path: '/pricing'
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



    // actions:


    // action calculateMTS();

type MTSInput {
    modelCode  : String(40);
    nsp        : Decimal(15,2);
    regionCode : String(10);
}

type MTSResult {
    modelCode         : String(40);
    regionCode        : String(10);
    actualNSP         : Decimal(15,2);

    helmet            : Decimal(15,2);
    transportation    : Decimal(15,2);
    dealerCost        : Decimal(15,2);
    otherExpenses     : Decimal(15,2);

    dealerMargin      : Decimal(15,2);
    helmetMargin      : Decimal(15,2);
    totalDealerMargin : Decimal(15,2);

    basicPrice        : Decimal(15,2);
    gstAmount         : Decimal(15,2);
    exShowroomPrice   : Decimal(15,2);
}

action calculateMTS(
    item : MTSInput
) returns MTSResult;



//---------------mto----------------------
// type MTOInput {
//     mtoModelCode : String(40);
//     regionCode   : String(10);
// }

type MTOInput {
    mtoModelCode          : String(40);
    regionCode            : String(10);

    approvedMTSNSP        : Decimal(15,2);
    approvedMTSExShowroom  : Decimal(15,2);
    approvedMTSOnRoad      : Decimal(15,2);
}
type MTOResult {

    mtoModelCode       : String(40);
    referenceMTSModel  : String(40);
    regionCode         : String(10);

    mtsNSP             : Decimal(15,2);
    mtsExShowroom      : Decimal(15,2);
    mtsOnRoad          : Decimal(15,2);

    miyExShowroomTotal : Decimal(15,2);
    miyOnRoadTotal     : Decimal(15,2);

    expectedExShowroom : Decimal(15,2);
    expectedOnRoad     : Decimal(15,2);

    mtoNSP             : Decimal(15,2);
    mtoExShowroom      : Decimal(15,2);
    mtoOnRoad          : Decimal(15,2);

    incrementDealer    : Decimal(15,2);
}


action calculateMTO(item : MTOInput) returns MTOResult;
   // action calculateMTO();

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
    //action calculateEV();

    action calculateGeM(modelCode:String(20));

    action calculateCSD();

    action calculateMultiRegion();

    action submitPricing();

    action approvePricing();

    action rejectPricing();


 
}