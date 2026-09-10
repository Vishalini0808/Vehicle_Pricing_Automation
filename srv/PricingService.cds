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


    action calculateMTS();

    action calculateMTO();

    action calculateEV();

    action calculateGeM(modelCode:String(20));

    action calculateCSD();

    action calculateMultiRegion();

    action submitPricing();

    action approvePricing();

    action rejectPricing();


 
}