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



    // actions:

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
    
    action calculateMTO();

    action calculateEV();

    action calculateGeM(modelCode:String(20));

    action calculateCSD();

    action calculateMultiRegion();

    action submitPricing();

    action approvePricing();

    action rejectPricing();


 
}