const { SELECT } = require("@sap/cds/lib/ql/cds-ql");

async function calculateMTS(NSP, regionCode, engineType,modelCode){

    

    console.log(`NSP Received : ${NSP} and Calculation Started !`);
    // console.log("Region Code  :", regionCode);
    // console.log("Engine Type  :", engineType);
    // console.log("modelCode:", modelCode);
    


    // Database connection
    const db = await cds.connect.to('db');


    // 1. Get Master tables
    const { PricingComponents, Models, RTOMasters , RTOExpense} = db.entities;


    // fetch required rows from Pricing components
    const pricingComponents = await SELECT.one.from(PricingComponents).where({
        regionCode : regionCode,
        engineType : engineType
    });

    console.log("Pricing Component:", pricingComponents);

    const hemlet = Number(pricingComponents.helmet);
    const helmetMargin = Number(pricingComponents.helmetMargin);
    const transportation = Number(pricingComponents.transportation);

    
    // 2. Calculate dealer cost 
    const dealerCost =  Number(NSP) +hemlet + transportation ;
    console.log(`Dealer Cost : ${dealerCost}`);


    // 3. Fetch Model from model master
    const model = await SELECT.one.from(Models).where({ modelCode : modelCode});
    console.log("Model record:", model);

    const gstPercentage = Number(model.gstPercent);
    const dealerMarginPercentage = Number(model.dealerMarginPercent);
    const cc = Number(model.ccWatt);

    // console.log("gst:",gstPercentage);
    // console.log("dealerMarginPercent:",dealerMarginPercentage);
    // console.log(cc);
    

    // 4. Calculate NDP => dealercost + (1 + gst % )
    const NDP = dealerCost * (1 + gstPercentage / 100);
    console.log("NDP:",NDP);


    // 5. Dealer Margin => NDP * dealermargin %
    const dealerMargin = NDP * (dealerMarginPercentage / 100);
    console.log("Dealer Margin:", dealerMargin)


    // 6. Total Dealer Margin => helmet margin + dealer margin
    const totalDealerMargin = helmetMargin + dealerMargin ;
    console.log("Total Dealer Margin:",totalDealerMargin);
    
    
    // 7. Other Expenses based on CC
    let otherExpenses ;

    if(cc >= 500 ) {
        otherExpenses = Number(pricingComponents.otherExpensesAbove500);
    }else {
        otherExpenses = Number(pricingComponents.otherExpensesBelow500);
    }

    // console.log("Othe Expenses:",otherExpenses);


    // 8. Basic price => Dealer cost + Total dealer margin + Other expense
    const basicPrice = dealerCost + totalDealerMargin + otherExpenses ;
    console.log("Basic Price : ", basicPrice);


    // 9. GST Amount calculate => basic price * gst %
    const gstAmount = basicPrice * (gstPercentage / 100);
    console.log("GST Amount:",gstAmount);


    // 10. Ex-showroom Price =>  basic price + gstAmount
    const exShowroomPrice = basicPrice + gstAmount ;
    console.log("Ex-Showroom Price:", exShowroomPrice);
    
    // 11. Fetch RTOMasters slab record:
    const rtoMasters = await SELECT.from(RTOMasters).where({
        region_regionCode : regionCode,
        engineType : engineType
    });

    console.log("RTO Master data :", rtoMasters);


    // Find Slab matching CC and Price range.
    let selectedRtoSlab ;
    const rtoPrice = exShowroomPrice ;

    for(let r of rtoMasters){

        if( 
            cc >= Number(r.ccMin) &&  
            cc <= Number(r.ccMax) &&
            rtoPrice >= Number(r.minimumPrice) &&
            rtoPrice <= Number(r.maximumPrice)
        ){
            console.log("RTO Slab :", r);
            selectedRtoSlab = r ;
            break;
        };

    };

    // throw error if no slab matches
    if (!selectedRtoSlab) {
            throw new Error("No matching RTO slab found");
        }
        
        console.log("RTO Percent:",selectedRtoSlab.rtoPercent);

    

    // 12. RTO Calculation => RTO Amount = RTO Price × RTO %
    // RTO Amount → government RTO/tax amount calculated from the RTO Master

    const rtoPercent = Number(selectedRtoSlab.rtoPercent);
    // console.log(rtoPrice);

    const rtoAmount = rtoPrice * rtoPercent ;
    console.log("RTO Amount:",rtoAmount);


     // 13. Fetch RTOExpense slab record:
    const rtoExpenses = await SELECT.from(RTOExpense).where({
        region_regionCode : regionCode,
        engineType : engineType
    });

    console.log("RTO Expense data:", rtoExpenses);

    // Find RTO expense Slab matching ex-showroom Price.
    let selectedRtoExpense ;

    for(let e of rtoExpenses){

        if( 
            rtoPrice >= Number(e.minimumPrice) &&
            rtoPrice <= Number(e.maximumPrice)
        ){
            console.log("RTO Expense Slab :", e);
            selectedRtoExpense = e ;
            break;
        };

    };

    // throw error if no slab matches
    if (!selectedRtoExpense) {
            throw new Error("No matching RTO expense slab found");
        }
        
        console.log("Selected RTO Expense:", selectedRtoExpense);


    // 14. RTO with Bill => ( rtoPrice * rtoExpense %) + rtoExpenseFixedAmount
    // RTO (With Bill) → handling/agent charge for processing the RTO, taken from the RTO Expense Master

    const rtoExpensePercentage = Number(selectedRtoExpense.percentage);
    const rtoExpenseFixedAmount = Number(selectedRtoExpense.fixedAmount);

    const rtoWithBill = ( rtoPrice * rtoExpensePercentage) + rtoExpenseFixedAmount;

    console.log("RTO With Bill : ", rtoWithBill);


    // 15. Insurance Amount => insuranceBase * insuranceRate
    // Insurance is calculated on 95% of Ex-Showroom Price

    const insuranceBase = rtoPrice * (95/ 100);
    
    let insuranceRate;

    // Select insurance rate based on CC
    if( cc <= 350){
        insuranceRate = Number(pricingComponents.insuranceRateBelow350);
    }else {
        insuranceRate = Number(pricingComponents.insuranceRateAbove350);
    };

    console.log("Insurance Base:", insuranceBase);
    console.log("Insurance Rate:", insuranceRate);


    const insuranceAmount = insuranceBase * insuranceRate ;
    console.log("Insurance Amount:", insuranceAmount);


    // 16. TPA / PA
    // Select TPA/PA amount based on vehicle CC
    
    let tpaPa;
    
    if (cc <= 350) {
        tpaPa = Number(pricingComponents.tpaPaBelow350);
    } else {
        tpaPa = Number(pricingComponents.tpaPaAbove350);
    }
    
    console.log("TPA/PA:", tpaPa);
    

    // 17. Insurane GST => (Insurance Amount + TPA/PA) × Insurance GST % configured for that CC band
    const insuranceGst = 0;


    // 18. Total insurance =>  insuranceAmount + tpaPa + insuranceGst;
    const totalInsurance = insuranceAmount + tpaPa + insuranceGst;

    console.log("Total Insurance :",totalInsurance);


    // 19. On-road Price => Ex-showroom + RTO Amount + RTO Expense + Total insurance
    const onRoadPrice = exShowroomPrice + rtoAmount + rtoWithBill + totalInsurance;
    
    console.log("On-Road Price:", onRoadPrice);

    return{
        NSP,
        dealerCost,
        NDP,
        dealerMargin,
        totalDealerMargin,
        otherExpenses,
        basicPrice,
        gstAmount,
        exShowroomPrice,
        rtoAmount,
        rtoWithBill,
        insuranceAmount,
        tpaPa,
        insuranceGst,
        totalInsurance,
        onRoadPrice
    }

}

module.exports = {
    calculateMTS
}
