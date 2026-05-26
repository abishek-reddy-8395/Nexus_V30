//+------------------------------------------------------------------+
//| NexusBridge.mq4 — Nexus V30 Terminal Final (MetaTrader 4)           |
//| READ-ONLY EA: syncs MT4 account data to Nexus backend            |
//| Cannot open, modify, or close any trade.                         |
//+------------------------------------------------------------------+
#property copyright "Nexus V30 Terminal"
#property version   "1.0"
#property strict

extern string SyncToken        = "";
extern string BackendUrl       = "https://your-backend.railway.app";
extern int    SyncIntervalSecs = 30;
extern bool   SyncOpenPos      = true;
extern bool   SyncHistory      = true;
extern int    HistoryDays      = 30;
extern bool   EnableLog        = true;
extern bool   DryRun           = false;

datetime g_last = 0; int g_count = 0;

int init(){
   if(StringLen(SyncToken)<10||StringFind(SyncToken,"NX-")<0){
      Alert("NexusBridge MT4: Invalid Sync Token.");
      return(-1);
   }
   Log("Initialised | Account: "+IntegerToString(AccountNumber()));
   DoSync(); return(0);
}
int deinit(){ Log("Stopped after "+IntegerToString(g_count)+" syncs."); return(0); }
int start(){ if(TimeCurrent()-g_last>=MathMax(SyncIntervalSecs,10)) DoSync(); return(0); }

void DoSync(){
   string payload=BuildPayload();
   if(DryRun){ Log("DRY RUN: "+StringSubstr(payload,0,120)+"..."); g_last=TimeCurrent(); g_count++; return; }
   string url=BackendUrl+"/api/broker/mt-sync";
   char post[]; char resp[]; string headers;
   StringToCharArray(payload,post,0,StringLen(payload));
   string h="Content-Type: application/json\r\nX-Sync-Token: "+SyncToken+"\r\n";
   int r=WebRequest("POST",url,h,15000,post,resp,headers);
   if(r==200||r==201){ g_count++; g_last=TimeCurrent(); if(EnableLog) Log("Sync #"+IntegerToString(g_count)+" OK"); }
   else Log("Sync failed HTTP "+IntegerToString(r));
}

string BuildPayload(){
   string j="{";
   j=j+"\"syncToken\":\""+SyncToken+"\",";
   j=j+"\"brokerType\":\"MT4\",";
   j=j+"\"accountId\":\""+IntegerToString(AccountNumber())+"\",";
   j=j+"\"account\":{\"balance\":"+DoubleToStr(AccountBalance(),2)+",\"equity\":"+DoubleToStr(AccountEquity(),2)+",\"margin\":"+DoubleToStr(AccountMargin(),2)+"},";
   j=j+"\"openPositions\":[";
   if(SyncOpenPos){ bool f=true;
      for(int i=0;i<OrdersTotal();i++){
         if(!OrderSelect(i,SELECT_BY_POS,MODE_TRADES)||OrderType()>1) continue;
         if(!f) j=j+","; f=false;
         j=j+"{\"ticket\":"+IntegerToString(OrderTicket())+",\"symbol\":\""+OrderSymbol()+"\",";
         j=j+"\"dir\":\""+(OrderType()==0?"BUY":"SELL")+"\",\"volume\":"+DoubleToStr(OrderLots(),2)+",";
         j=j+"\"openPrice\":"+DoubleToStr(OrderOpenPrice(),8)+",\"profit\":"+DoubleToStr(OrderProfit(),2)+"}";
      }
   }
   j=j+"],\"closedTrades\":[";
   if(SyncHistory){
      datetime from=TimeCurrent()-(HistoryDays*86400);
      bool f=true; int w=0;
      for(int i=OrdersHistoryTotal()-1;i>=0&&w<200;i--){
         if(!OrderSelect(i,SELECT_BY_POS,MODE_HISTORY)||OrderType()>1||OrderCloseTime()<from) continue;
         if(!f) j=j+","; f=false;
         double net=OrderProfit()+OrderSwap()+OrderCommission();
         j=j+"{\"ticket\":"+IntegerToString(OrderTicket())+",\"symbol\":\""+OrderSymbol()+"\",";
         j=j+"\"dir\":\""+(OrderType()==0?"BUY":"SELL")+"\",\"openPrice\":"+DoubleToStr(OrderOpenPrice(),8)+",";
         j=j+"\"profit\":"+DoubleToStr(OrderProfit(),2)+",\"netProfit\":"+DoubleToStr(net,2)+",";
         j=j+"\"closeTime\":"+IntegerToString(OrderCloseTime())+"}";
         w++;
      }
   }
   j=j+"]}"; return(j);
}
void Log(const string m){ if(EnableLog) Print("[NexusBridge] "+m); }
