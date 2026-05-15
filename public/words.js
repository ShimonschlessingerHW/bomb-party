// Word validation + prompt syllables for Bomb Party

// ── Letter-combination prompts (2-3 chars, common in English words) ──
export const PROMPTS = [
  // Easy (appear in 100s of common words)
  "AN","IN","ER","ON","EN","AT","OR","ED","ES","LE","AR","RE",
  "ST","TH","NG","NT","AL","IT","LY","IC","OU","OW","AY","TE",
  "SE","RI","IS","EM","HE","LI","DE","BE","AC","CE","IL","UR",
  "OM","OT","EL","EE","OO",
  // Medium
  "ING","TER","ION","ANT","EST","OUR","ENT","AIN","ALL","OWN",
  "AGE","ACE","ICE","ATE","ORS","ARD","OOD","EAD","EAR","EAT",
  "EED","EEL","EEP","EER","AID","ORE","ORD","ORM","ORK","ORT",
  "ANG","ANK","AND","END","ERS","ARK","ARM","ART","AST","ASH",
  "INK","INT","ISH","IST","OLD","OLT","ONG","ONT","OOK","OOL",
  "OON","OOP","OOR","OOT","OUL","OUN","OUR","OUS","OUT","OWL",
  "OWN","OWS","PRE","SCR","SHI","SHO","SHR","SHU","SKI","SKY",
  "SLA","SLI","SLO","SMA","SMI","SNA","SNO","SPA","SPE","SPI",
  "SPO","SPR","SQU","STR","STU","STY","SWA","SWE","SWI","SWO",
  "TRA","TRE","TRI","TRO","TRU","TWI","TWO","ULT","UMB","UMP",
  "UNG","UNK","UNN","UNS","UNT","UNU","UPP","UPT","URN","URP",
  // Harder
  "PHO","QUA","QUE","QUI","QUO","XAM","ZAP","ZAR","ZEN","ZIG",
  "ZIP","ZIT","ZOO","ZAG","WRA","WRE","WRI","WRO",
];

// ── Fallback word set (loads fast, covers common bomb-party words) ──
const FALLBACK_WORDS = new Set([
"aardvark","ability","able","about","above","absent","absorb","abstract","accept","access",
"accident","account","accurate","achieve","across","action","active","activity","actually","adapt",
"add","address","adjust","adult","advance","after","again","against","agent","ago",
"agree","ahead","air","alarm","all","allow","almost","alone","along","already",
"also","although","always","among","amount","ancient","angle","angry","animal","another",
"answer","any","appeal","appear","apple","apply","area","around","arrive","ask",
"aware","awful","baby","back","badly","balance","base","basic","battle","beautiful",
"become","before","begin","being","believe","below","between","beyond","big","bird",
"bitter","black","blame","blood","blow","blue","body","bold","book","born",
"both","break","brief","bright","bring","broad","broken","brown","build","busy",
"call","calm","came","card","care","carry","case","catch","cause","center",
"change","charge","check","child","choice","choose","city","claim","class","clean",
"clear","close","color","come","common","complete","concern","control","copy","cost",
"could","count","cover","crash","create","cross","crowd","current","curve","cut",
"dark","data","deal","deep","degree","design","different","difficult","direct","discover",
"distance","divide","does","done","draw","dream","drive","drop","during","each",
"early","earth","east","edge","either","else","empty","energy","enjoy","enter",
"equal","even","event","ever","every","exact","exist","expect","experience","explain",
"extra","fail","fall","false","family","fast","fear","feel","few","field",
"fight","figure","fill","film","final","find","fire","first","five","fixed",
"floor","flow","focus","fold","follow","force","forest","form","forward","found",
"four","free","fresh","from","front","full","function","game","given","glass",
"goal","goes","gold","good","grade","great","green","group","grow","guard",
"hand","happen","hard","have","hear","heart","heavy","help","hide","high",
"hold","hole","home","hope","huge","idea","image","impact","important","inner",
"inside","instead","iron","island","issue","keep","kind","know","lack","large",
"late","layer","learn","leave","level","light","like","line","list","live",
"local","long","lose","lost","loud","love","lower","luck","main","major",
"make","many","mark","mean","mind","minor","miss","model","money","more",
"most","move","much","must","natural","near","need","next","night","none",
"note","nothing","notice","number","object","offer","often","open","order","other",
"outside","over","pair","part","pass","past","path","person","picture","piece",
"place","plan","plant","play","point","power","produce","proof","provide","pull",
"push","quick","quite","raise","range","reach","read","ready","real","reason",
"reduce","refer","release","remain","report","result","return","right","risk","road",
"role","round","rule","safe","same","save","scale","scene","science","seem",
"send","sense","serve","shape","share","shift","show","side","sign","simple",
"since","size","skill","small","smart","solve","some","sort","space","speak",
"speed","spend","stand","start","state","stay","step","still","stop","store",
"story","study","style","such","supply","support","sure","surface","take","talk",
"term","test","than","their","there","thing","think","this","three","through",
"time","together","total","touch","track","trade","train","trust","truth","turn",
"type","under","unique","until","upon","upper","used","using","usual","value",
"view","visit","voice","wait","walk","want","water","week","where","which",
"while","wide","will","within","without","word","work","world","would","write",
"year","yesterday","zone",
"ability","absence","absolute","abstract","abuse","academic","accept","access","accuse","achieve",
"action","adapt","adequate","admire","admit","adopt","advance","adverse","affect","afford",
"afraid","afterwards","agenda","aggressive","alert","align","allocate","alter","analyze","announce",
"annual","appear","appoint","approach","appropriate","approve","argue","arrange","assert","assess",
"assign","assist","assume","attach","attempt","attend","attract","attribute","authority","battle",
"benefit","bother","boundary","bridge","burden","capable","capture","careful","celebrate","certain",
"chapter","citizen","colony","commit","communicate","compare","compete","complex","condition","conflict",
"conscious","consequence","construct","contain","context","contract","contribute","convert","correct","creative",
"critical","debate","decide","declare","define","delay","demand","depend","describe","develop",
"dimension","direction","eliminate","enable","enforce","enhance","ensure","entire","establish","evaluate",
"evident","examine","example","exhibit","expand","extend","extreme","factor","feature","finance",
"flexible","formal","formula","fundamental","general","generate","genuine","global","govern","grant",
"handle","identify","implement","improve","include","indicate","individual","influence","inspire","intend",
"introduce","invest","involve","isolate","justify","maintain","manage","measure","method","mistake",
"modify","monitor","motive","multiple","negative","obtain","operate","option","outcome","output",
"overcome","position","positive","potential","practice","precise","prefer","prepare","present","prevent",
"primary","priority","process","progress","promote","protect","purpose","pursue","quality","quantity",
"question","realize","recognize","record","recover","reduce","reform","refuse","region","regulate",
"relate","relevant","replace","require","resolve","resource","respond","restrict","retain","reveal",
"review","revise","schedule","section","select","separate","sequence","signal","similar","solution",
"specific","statement","status","strategy","strengthen","structure","subject","success","sufficient","suggest",
"summary","symbol","target","technical","technology","theory","transfer","transform","transition","ultimate",
"understand","unique","update","upgrade","utilize","version","visible","wealth","welcome","willing",
"abandon","abroad","absent","abundant","achieve","activate","actual","addition","adequate","adjacent",
"admirable","advanced","advantage","affection","aggressive","anguish","announce","apparent","appetite","appropriate",
"arbitrary","argument","around","arrangement","arrest","artificial","aspect","assemble","assign","assistance",
"assume","assurance","attachment","attention","attract","available","balance","balanced","basis","behavior",
"benefit","beyond","bilateral","borrow","bravery","brilliant","capture","caution","challenge","champion",
"character","charity","classical","combine","command","complexity","composition","concept","conclusion","confident",
"consistent","constant","contrary","conviction","cooperation","correct","creative","crucial","define","deliver",
"demonstrate","display","distribute","diverse","dynamic","effective","efficient","elaborate","element","emphasis",
"encourage","energy","engage","environment","equality","establish","evaluate","evidence","evolve","exactly",
"excellent","exchange","exclusive","exercise","expect","experience","express","faithful","familiar","fascinating",
"favorite","fiction","flexible","flourish","fluent","foundation","freedom","frequent","function","generous",
"genuine","global","graceful","grateful","harmony","helpful","historic","honest","humble","humor",
"impact","independent","infinite","initial","innovative","interact","intimate","involve","knowledge","landscape",
"leadership","liberty","logical","maximum","maximum","meaningful","memorable","minimum","moderate","modern",
"moment","movement","narrative","national","necessary","neutral","notable","observe","opportunity","optional",
"organic","original","outstanding","overcome","patience","permanent","perspective","physical","positive","powerful",
"practical","principle","priority","productive","promise","protect","provide","public","rational","reasonable",
"recognize","remarkable","repeat","respect","responsibility","restore","robust","safety","satisfy","secure",
"sensitive","significant","situation","skilled","society","solution","stability","strengthen","structure","successful",
"supplement","support","survival","sustainable","systematic","thorough","tradition","transparent","trust","ultimate",
"uniform","unique","universal","valid","variable","vast","versatile","vibrant","voluntary","wisdom",
"achieve","acquire","balance","capable","certain","challenge","clarify","complex","confirm","consider",
"create","decide","deliver","depict","design","discover","display","dissolve","distribute","document",
"dominate","enable","enforce","enhance","ensure","escalate","examine","execute","expand","explore",
"express","extract","facilitate","focus","follow","forecast","formulate","generate","govern","guide",
"illustrate","improve","indicate","initiate","integrate","interpret","investigate","justify","launch","manage",
"measure","modify","navigate","observe","outline","overcome","perform","predict","prepare","prioritize",
"promote","protect","provide","publish","recognize","reduce","regulate","release","replace","represent",
"resolve","respond","review","schedule","select","structure","suggest","support","transform","update",
"abandon","access","address","affect","align","appeal","argue","arrange","assess","assist",
"attack","attempt","balance","benefit","capture","carry","challenge","change","combine","commit",
"compete","complete","compose","connect","construct","contain","control","convert","cope","correct",
"create","decide","defend","define","deliver","describe","design","destroy","develop","direct",
"discover","distribute","divide","eliminate","enable","establish","evaluate","examine","experience","explain",
"extend","figure","force","forward","gain","generate","grow","guide","handle","identify",
"implement","improve","include","indicate","influence","integrate","introduce","involve","justify","maintain",
"manage","measure","modify","monitor","obtain","operate","organize","overcome","perform","prepare",
"present","prevent","produce","promote","protect","provide","pursue","qualify","realize","recognize",
"record","recover","reduce","relate","remain","remove","repair","replace","require","resolve",
"respond","restrict","return","reveal","select","separate","solve","specify","state","strengthen",
"structure","submit","suggest","support","survive","target","test","transfer","transform","update",
"validate","verify","waste","welcome","achieve","arrange","balance","challenge","clarify","combine",
"connect","construct","control","create","decide","define","design","distribute","divide","enhance",
"ensure","establish","evaluate","examine","explain","extend","generate","guide","identify","implement",
"improve","integrate","introduce","justify","manage","measure","modify","monitor","organize","perform",
"prepare","prevent","prioritize","produce","promote","protect","pursue","realize","recognize","reduce",
"regulate","remove","replace","require","resolve","respond","select","solve","strengthen","support",
"transform","update","validate","build","carry","check","clear","close","connect","correct","cover",
"bring","cold","copy","cute","door","draw","face","fact","fair","fall",
"farm","fast","fear","feel","fell","felt","fine","fire","five","flag",
"flat","flow","foam","fold","fond","food","fool","ford","fork","form",
"four","free","from","full","gain","gave","gift","give","glad","glow",
"gold","gone","good","grab","grew","grin","grip","grow","gulf","half",
"halt","hang","hard","harm","hate","have","head","heal","heap","heat",
"held","help","here","hide","high","hill","hint","hire","hole","holy",
"home","hood","hook","hope","horn","hour","huge","hung","hunt","hurt",
"icon","idea","inch","into","iron","jack","jail","join","joke","jump",
"just","keen","kill","king","kiss","knew","lace","laid","lake","lamp",
"lane","late","lead","leaf","lean","left","lend","less","lift","link",
"lion","list","load","lock","loft","lone","loop","loss","loud","mail",
"main","male","mare","mark","meal","meet","melt","milk","mill","mine",
"mint","miss","mock","mode","mood","moon","more","most","much","nail",
"name","news","nice","nine","node","noon","norm","nose","null","oath",
"once","only","open","oral","over","pace","pack","page","paid","pain",
"pale","palm","park","peak","pick","pile","pine","pipe","plan","play",
"plot","plus","poem","pole","pool","poor","port","pose","post","pour",
"pray","prep","prey","pull","pure","rage","raid","rail","rain","rake",
"rank","rare","rate","read","real","reef","rely","rent","rest","rice",
"rich","ride","ring","riot","rise","risk","road","roar","rock","role",
"room","rope","rose","roam","ruin","rush","rust","sail","sake","sale",
"salt","sand","sang","sank","seal","seat","seed","seek","sell","send",
"sent","shed","shoe","shot","sick","silk","sing","sink","site","skip",
"slam","slim","slow","snow","soap","soft","soil","sold","sole","song",
"soon","sort","soul","soup","sour","sown","span","sped","spin","spot",
"star","stem","step","slim","stop","suit","sure","swan","swim","tail",
"tale","tall","tank","tape","task","taxi","tear","tent","text","than",
"then","they","thin","tick","tide","tied","tier","tile","till","tiny",
"tire","told","toll","tomb","tome","tone","tool","torn","tour","town",
"trail","trim","trio","trip","true","tube","tune","twin","upon","vast",
"veil","vein","very","vest","view","vine","void","vote","wade","wage",
"wake","wall","warn","warp","wars","wash","wave","waxy","weak","wear",
"weed","well","west","when","whim","whip","wild","wind","wine","wing",
"wire","wise","wish","with","wolf","wood","worm","worn","wrap","writ",
"yawn","yell","your","zero",
// 3+ syllable useful words
"abstract","accomplish","accurate","accurate","action","actually","adventure","afternoon","afterward","agency",
"almost","already","alphabet","altitude","amendment","another","anyone","anything","anyway","anywhere",
"appear","approach","autumn","bargain","beautiful","because","before","begin","believe","beneath",
"between","beyond","birthday","blossom","bottom","boundary","broken","brought","caution","charity",
"children","chocolate","citizen","college","column","common","compete","complete","contain","couple",
"culture","custom","danger","daughter","decide","degree","delay","deliver","delight","describe",
"despite","discover","disease","distant","doctor","drama","during","early","easily","economy",
"effort","either","emotion","enough","enter","error","evening","example","explain","explore",
"failure","falling","family","famous","father","feeling","fiction","finally","finish","flower",
"foreign","forest","forget","formal","future","garden","general","gentle","getting","golden",
"gotten","happen","happy","having","hidden","however","hundred","hungry","imagine","indeed",
"injury","inside","instant","instead","interest","journey","justice","kitchen","language","laughter",
"leader","lesson","letter","library","listen","little","living","longer","looking","magic",
"making","manner","maybe","middle","might","million","minute","mirror","mission","moment","monkey",
"morning","mother","moving","mystery","narrow","nation","nature","never","notice","novel",
"number","object","office","often","orange","origin","other","other","outside","owner",
"painting","paper","patient","pattern","perfect","perhaps","period","person","piece","planet",
"plastic","player","please","pocket","poison","polite","popular","power","pretty","problem",
"promise","proper","protect","proud","public","purpose","puzzle","really","reason","recent",
"recipe","region","relate","remain","rescue","return","reveal","reward","river","secure","sister",
"slowly","smooth","soldier","somehow","someone","something","sometimes","somewhere","sorry","special",
"station","story","strange","street","strong","sudden","summer","sunset","surprise","talent",
"target","teach","thunder","travel","trouble","twenty","under","unique","until","unusual",
"village","voyage","waiting","weather","window","winter","wisdom","within","wonder","yellow",
// Science / class words
"atmosphere","carbon","chemical","circuit","climate","compound","density","element","energy",
"equation","erosion","evolution","friction","gravity","habitat","hormone","hydrogen","kinetic",
"molecule","neutron","nucleus","organism","oxygen","particle","photon","plasma","pressure","proton",
"quantum","reaction","relative","solution","spectrum","thermal","velocity","voltage","wavelength",
// Math words
"algebra","angle","calculate","decimal","divide","equation","factor","fraction","geometry","hypotenuse",
"integer","median","multiply","negative","parallel","percent","polygon","positive","radius","rational",
"square","triangle","variable","vertical",
// Common adjectives
"absent","active","acute","adequate","adjacent","afraid","aggressive","ambitious","ancient","angry",
"anxious","appropriate","astonishing","average","awkward","basic","bitter","bland","brave","brilliant",
"broad","calm","capable","careful","casual","cautious","cheerful","clever","cold","conscious",
"curious","delicate","desperate","different","distant","dull","eager","elegant","empty","enormous",
"equal","essential","evident","exact","excellent","excited","exhausted","famous","fancy","fierce",
"flexible","fragile","fresh","generous","gentle","genuine","harsh","healthy","honest","huge",
"humble","intelligent","intense","lively","lovely","magnificent","massive","mature","modest","nervous",
"noble","obvious","ordinary","patient","peculiar","perfect","pleasant","polite","precious","profound",
"quiet","reliable","remarkable","rough","serious","sharp","significant","simple","sincere","slight",
"smooth","solid","stern","strong","superior","tender","tired","trivial","typical","ugly","unusual",
"useful","vague","valid","vast","violent","vivid","vulnerable","warm","weary","wonderful","worthy",
// Common verbs
"accept","achieve","acquire","act","adapt","add","adjust","admire","adopt","advance",
"advise","affect","afford","agree","aim","allow","alter","analyze","announce","appear",
"apply","arrange","ask","assume","attach","attend","attract","avoid","beg","blame",
"carry","catch","celebrate","change","choose","clarify","collect","combine","commit","compare",
"compete","confirm","connect","consider","construct","contact","continue","contribute","control","convince",
"cooperate","correct","cover","crash","create","damage","decide","declare","delay","demand",
"depend","describe","desire","destroy","determine","develop","disappear","discuss","display","drive",
"eliminate","emerge","enable","encounter","enjoy","ensure","enter","establish","evaluate","examine",
"exist","expand","expect","experience","explain","explore","express","fail","focus","force",
"forget","gather","generate","grant","grow","guide","handle","identify","ignore","improve",
"include","influence","integrate","interact","introduce","invest","involve","keep","lead","learn",
"listen","make","manage","modify","monitor","move","notice","obtain","occur","organize",
"participate","perform","plan","play","prefer","prepare","prevent","produce","promote","protect",
"provide","pursue","recognize","reduce","reflect","refuse","release","remain","replace","respond",
"reveal","save","seek","select","separate","solve","spend","strengthen","submit","suggest",
"support","survive","teach","tend","test","transfer","transform","trust","understand","use",
"value","verify","wait","want","work","worry","write",
]);

let wordCache = {};
try { wordCache = JSON.parse(localStorage.getItem('bp_word_cache') || '{}'); } catch(e) {}

function saveCache() {
  try { localStorage.setItem('bp_word_cache', JSON.stringify(wordCache)); } catch(e) {}
}

/**
 * Check if a word is valid English.
 * 1. Check localStorage cache
 * 2. Check bundled fallback set
 * 3. Call Free Dictionary API (with timeout)
 */
export async function isValidWord(word) {
  const w = word.toLowerCase().trim();
  if (w.length < 2) return false;

  if (w in wordCache) return wordCache[w];
  if (FALLBACK_WORDS.has(w)) { wordCache[w] = true; saveCache(); return true; }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    const valid = resp.ok;
    wordCache[w] = valid;
    saveCache();
    return valid;
  } catch {
    // API unavailable — trust the fallback set; unknown words get benefit of the doubt
    return FALLBACK_WORDS.has(w);
  }
}

/**
 * Pick a random prompt based on difficulty setting + round.
 * difficulty: 'beginner' | 'normal' | 'hard' | 'insane'
 */
export function randomPrompt(difficulty = 'beginner', round = 1) {
  // PROMPTS is ordered easiest → hardest (by how many common words contain them)
  // beginner: easy 2-letter combos only
  // normal:   2-letter + common 3-letter
  // hard:     full set including rare 3-letter
  // insane:   full set including tough combos
  let pool;
  switch (difficulty) {
    case 'insane': pool = PROMPTS;                  break;
    case 'hard':   pool = PROMPTS.slice(0, 110);    break;
    case 'normal': pool = PROMPTS.slice(0, 80);     break;
    case 'beginner':
    default:
      // In early rounds stay very easy; open up a little each round
      if (round <= 2)      pool = PROMPTS.slice(0, 40);
      else if (round <= 5) pool = PROMPTS.slice(0, 60);
      else                 pool = PROMPTS.slice(0, 80);
      break;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
