//+------------------------------------------------------------------+
//| NexusBridge.mq5 — Nexus V30 Terminal Final                          |
//| READ-ONLY EA: syncs MT5 account data to Nexus backend            |
//| Cannot open, modify, or close any trade.                         |
//+------------------------------------------------------------------+
#property copyright "Nexus V30 Terminal"
#property version   "1.0"
#property strict

input string SyncToken        = "";      // Nexus Sync Token (from Settings → Brokers)
input string BackendUrl       = "https://your-backend.railway.app";
input int    SyncIntervalSecs = 30;
input bool   SyncOpenPos      = true;
input bool   SyncHistory      = true;
input int    HistoryDays      = 30;
input bool   EnableLog        = true;
input bool   DryRun           = false;

datetime g_lastSync = 0;
int      g_count    = 0;

int OnInit() {
   if(StringLen(SyncToken)<10||StringFind(SyncToken,"NX-")<0){
      Alert("NexusBridge: Invalid Sync Token. Get it from Nexus → Settings → Brokers → MT5.");
      return INIT_PARAMETERS_INCORRECT;
   }
   Log("NexusBridge initialised | Account: "+IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)));
   DoSync(); return INIT_SUCCEEDED;
}
void OnDeinit(const int r){ Log("Stopped after "+IntegerToString(g_count)+" syncs."); }
void OnTick(){ if(TimeCurrent()-g_lastSync>=MathMax(SyncIntervalSecs,10)) DoSync(); }

void DoSync(){
   string payload = BuildPayload();
   if(DryRun){ Log("DRY RUN: "+StringSubstr(payload,0,120)+"..."); g_lastSync=TimeCurrent(); g_count++; return; }
   string url = BackendUrl+"/api/broker/mt-sync";
   char post[]; char resp[]; string headers;
   StringToCharArray(payload, post, 0, StringLen(payload), CP_UTF8);
   string h = "Content-Type: application/json\r\nX-Sync-Token: "+SyncToken+"\r\n";
   int r = WebRequest("POST", url, h, 15000, post, resp, headers);
   if(r==200||r==201){ g_count++; g_lastSync=TimeCurrent(); if(EnableLog) Log("Sync #"+IntegerToString(g_count)+" OK"); }
   else Log("Sync failed HTTP "+IntegerToString(r));
}

string BuildPayload(){
   string j="{";
   j+="\"syncToken\":\""+SyncToken+"\",";
   j+="\"brokerType\":\"MT5\",";
   j+="\"accountId\":\""+IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))+"\",";
   j+="\"account\":{";
   j+="\"balance\":"+DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)+",";
   j+="\"equity\":"+DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2)+",";
   j+="\"margin\":"+DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN),2)+",";
   j+="\"freeMargin\":"+DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE),2)+"},";
   j+="\"openPositions\":[";
   if(SyncOpenPos){ bool f=true;
      for(int i=0;i<PositionsTotal();i++){
         ulong tk=PositionGetTicket(i); if(!tk) continue;
         if(!f) j+=","; f=false;
         j+="{\"ticket\":"+IntegerToString((long)tk)+",";
         j+="\"symbol\":\""+PositionGetString(POSITION_SYMBOL)+"\",";
         j+="\"dir\":\""+(PositionGetInteger(POSITION_TYPE)==0?"BUY":"SELL")+"\",";
         j+="\"volume\":"+DoubleToString(PositionGetDouble(POSITION_VOLUME),2)+",";
         j+="\"openPrice\":"+DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN),_Digits)+",";
         j+="\"profit\":"+DoubleToString(PositionGetDouble(POSITION_PROFIT),2)+"}";
      }
   }
   j+="],\"closedTrades\":[";
   if(SyncHistory){
      datetime from=TimeCurrent()-(HistoryDays*86400);
      HistorySelect(from,TimeCurrent());
      bool f=true; int w=0;
      for(int i=0;i<HistoryDealsTotal()&&w<200;i++){
         ulong tk=HistoryDealGetTicket(i); if(!tk) continue;
         if(HistoryDealGetInteger(tk,DEAL_ENTRY)!=DEAL_ENTRY_OUT) continue;
         if(!f) j+=","; f=false;
         double profit=HistoryDealGetDouble(tk,DEAL_PROFIT);
         double swap=HistoryDealGetDouble(tk,DEAL_SWAP);
         double comm=HistoryDealGetDouble(tk,DEAL_COMMISSION);
         j+="{\"ticket\":"+IntegerToString((long)tk)+",";
         j+="\"symbol\":\""+HistoryDealGetString(tk,DEAL_SYMBOL)+"\",";
         j+="\"dir\":\""+(HistoryDealGetInteger(tk,DEAL_TYPE)==0?"BUY":"SELL")+"\",";
         j+="\"openPrice\":"+DoubleToString(HistoryDealGetDouble(tk,DEAL_PRICE),8)+",";
         j+="\"profit\":"+DoubleToString(profit,2)+",";
         j+="\"netProfit\":"+DoubleToString(profit+swap+comm,2)+",";
         j+="\"closeTime\":"+IntegerToString((long)HistoryDealGetInteger(tk,DEAL_TIME))+"}";
         w++;
      }
   }
   j+="]}"; return j;
}
void Log(const string m){ if(EnableLog) PrintFormat("[NexusBridge] %s",m); }
