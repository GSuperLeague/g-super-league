import type { GalleryLeague, HomeGalleryItem } from "./gallery.ts";

export type GalleryMemeAnalysis = {
  title: string;
  tags: string[];
  punchline: string;
  analysis: string;
  verdict: string;
};

export const GALLERY_MEME_ANALYSES: Record<string, GalleryMemeAnalysis> = {
  // 01 [football] Sitting on office chair in gym throwing both arms up
  "4d58b6e277b8960fa0ce3ca83c507a54fc396830893c3294ad3a754e29414cfb": {
    title: "《工学椅战神：坐着也能封神》",
    tags: ["人体工学外挂", "仰天长啸", "气氛组拉满"],
    punchline:
      "别人打桌足靠站姿和腰马合一，这位直接把带滑轮的办公转椅推上了健身房橙色跑道，一边向后仰倒一边双臂高举庆祝。",
    analysis:
      "画面反差极强：脚下是标着米数的专业冲刺跑道，身旁是满屋铁片器械，他却稳坐人体工学椅上演“躺赢式高举双手”。旁边红衣搭档不仅没觉得违和，还面带慈祥微笑鼓掌捧场，仪式感直接拉满。",
    verdict: "站着打是竞技，坐着转椅滑步打是降维打击。",
  },
  // 02 [football] Office chair pulled onto 3M gym sprint track while someone lifts dumbbell in mirror
  "adeaf67da719c81d7708da56891320f2492035ead3d67e23952fe361675c4469": {
    title: "《3M 跑道上的 VIP 观赛专座》",
    tags: ["工位即球场", "背景抢戏", "站坐分明"],
    punchline:
      "全场四人围桌激战，三人认真罚站，唯独右下角白衣选手把滑轮椅精准停在 3M 标线上，主打一个“能坐绝不站”。",
    analysis:
      "仔细看背景左上角还有隐藏彩蛋：一位硬核健身人士正高举哑铃专注练肩，而前景四位已经彻底把健身房改造为“GAIR 桌足电竞馆”，墙上还挂着飞镖盘，妥妥的午休多巴胺补给站。",
    verdict: "健身房最大的器材利用率，一半归哑铃，一半归桌足。",
  },
  // 03 [football] Black jacket pointing and laughing between two foosball tables
  "16241e48f008578ff99bdb52dd80633db35f5d18bd28ca58fb0ac862c3b1523e": {
    title: "《指点江山，笑到直不起腰》",
    tags: ["经典指人梗", "嘲讽拉满", "双桌夹击"],
    punchline:
      "站在两张桌足台的黄金 C 位，手一抬、嘴一咧、眼一眯，完美复刻“我就指着你笑”的世界级名画姿势。",
    analysis:
      "构图堪称自带语音包：不需要任何字幕，光看这记直指画外的食指和藏不住的狂笑，就能脑补出隔壁桌刚刚踢出了一记载入史册的离谱乌龙球或空气射门。",
    verdict: "伤害性不高，但指着你笑的侮辱性极强。",
  },
  // 04 [football] Motion-blurred sprinting away laughing while cyan hoodie turns back walking away
  "752bd37806c56bb5a8835ccb262287b5240f803ecd0a42a5a04bae685c9ddcfc": {
    title: "《高速逃离案发现场》",
    tags: ["自带动态模糊", "悲喜两重天", "提桶跑路"],
    punchline:
      "左边黑衣选手笑到快门都追不上、直接触发高速残影；右边青色卫衣选手默默转身挥手离去，留下一道写满故事的背影。",
    analysis:
      "动态模糊永远是喜剧效果的顶级催化剂！画面里两个人朝完全相反的方向运动：一个像刚打进绝杀球绕场狂奔，另一个像刚被自己人弹反乌龙后准备原地退役。",
    verdict: "摄影师没开连拍，但这张糊度刚刚好糊在了笑点上。",
  },
  // 05 [football] Dynamic one-leg kick-back stance gripping rods, both grinning
  "6bc0b35e22360e35de99e2f5c7863039496e212c6d2cce4325f9a34aff0f6cdf": {
    title: "《单脚后蹬：物理外挂蓄力中》",
    tags: ["动作大片", "快乐桌足", "重心起飞"],
    punchline:
      "明明只用手转球杆，左脚却已经本能地向后蹬出起跑姿态，全身每一块肌肉都在给这脚射门配音。",
    analysis:
      "最治愈的是两位队友嘴角同步上扬的弧度——黑衣前锋全力发力，青衣后卫在旁笑得合不拢嘴，完美诠释什么叫“战绩可以输，节目效果必须拉满”。",
    verdict: "手在转杆，脚在凌空抽射，心已经在伯纳乌滑跪。",
  },
  // 06 [football] Both teammates doubled over laughing over the table
  "c90350ab7842ea994d400517ad8d3011a51cbc9000090a931f09df9be5a1adaa": {
    title: "《笑到集体丧失防守能力》",
    tags: ["双人破防", "笑点溢出屏幕", "球还在滚"],
    punchline:
      "一队两个人同时弯腰笑到失去行动能力，青衣队友张大嘴狂乐，黑衣队友头都快埋进绿茵场里了。",
    analysis:
      "右下角对手伸手进场捡球的动作更是点睛之笔——说明这球不仅进了，而且进得极其离谱，以至于双方在那一刻达成共识：胜负不重要，先笑够十秒再说。",
    verdict: "G超最强进攻战术：先用离谱操作把对面笑到握不住杆。",
  },
  // 07 [football] Four-man tactical seminar around table, blue jacket hands on hips
  "b127f4c2e06d9cf30efd6cb0d63d847c729e6eefc954454b3d5943e12b2570f1": {
    title: "《G超战术复盘研讨会》",
    tags: ["名帅叉腰", "学术派桌足", "全场严肃"],
    punchline:
      "左侧高领毛衣老哥现场演练微操，后面蓝衣选手双手叉腰神情凝重，活脱脱世界杯场边主教练在审视阵型。",
    analysis:
      "整张画面透着一股科研人的严谨气质：四个人的视线全部聚焦在巴掌大的塑料球场上，仿佛下一秒就要掏出白板推导“弹反动量守恒与爆冲角速度模型”。",
    verdict: "外行看热闹，内行已经在算入射角和出射角了。",
  },
  // 08 [football] Locked-in stoic focused close-up of black jacket player
  "38ce5441f5bffd6fc28469607e08d0f0d7abe1dc06aee462bb182e46035c4d04": {
    title: "《收起笑容，进入“认真模式”》",
    tags: ["反差感拉满", "冷酷杀手", "眼神锁定"],
    punchline:
      "上一秒还在球场边笑到扶墙，这一秒镜片微反暖光、低眸紧盯球路，瞬间切换成动漫男主开启“领域展开”的气场。",
    analysis:
      "双手稳稳扣住手柄、嘴角收平、肩线微沉——在 G超图库一堆大笑抓拍里，这张难得的严肃定格反而因为强烈反差显得格外好笑又帅气。",
    verdict: "警告：当一个平时笑得最大声的人突然不笑了，说明这球要来真的了。",
  },
  // 09 [football] Cyan hoodie inspecting goal while black jacket sits alone on gym bench
  "ea045a8989c434697912f312b0ada2c24c28d769a48af5fafda468383976125f": {
    title: "《前排掏球，后排看淡红尘》",
    tags: ["绝妙前后景", "替补席哲学", "背影有戏"],
    punchline:
      "前景青衣大哥俯身全神贯注研究球门里的球，后景黑衣老哥独自坐在健身凳上望向窗外，仿佛已经看透了 Elo 段位分的起起落落。",
    analysis:
      "构图神似电影分镜：前排是热火朝天的竞技现场，后排是“连跪三把后独自在替补席思考人生”的孤寂身影，加上青衣背后狂野涂鸦兔图案，画面层次直接拉满。",
    verdict: "这哪是休息凳，分明是“段位冷却冥想区”。",
  },
  // 10 [football] Black jacket clutching Technogym machine laughing uncontrollably
  "fc171ab5f6575ac7a8ff97eb347d0c41a5b5b2ca1c4f4d2384ff4f36cdc820db": {
    title: "《笑到必须扶着泰诺健才能站稳》",
    tags: ["笑出腹肌", "器材新用法", "全场最佳表情"],
    punchline:
      "都说来健身房是练核心的，这位另辟蹊径——打桌足笑到核心失力，只能一把扶住旁边的 Technogym 器械勉强保住平衡。",
    analysis:
      "右手扶着价值不菲的健身器材，双腿迈着踉跄小碎步，嘴角咧到耳根、眼睛眯成两条缝，右边空荡荡的桌足台就是这场爆笑事故的唯一证人。",
    verdict: "今天的腹肌训练已完成：笑肌力竭 3 组，每组 15 秒。",
  },
  // 11 [football] Shoulder-to-shoulder hyper-focused teammates, treadmill behind
  "15fa6bc1d560b8b9fdcfc4bbdbef2d85074a05a88d3fa0b7915d0705dcc31d5a": {
    title: "《双人并肩：专注度拉满 200%》",
    tags: ["铁血搭档", "眼神如炬", "手速预警"],
    punchline:
      "两位搭档肩并肩压低重心，四只手死死锁住球杆，眼神锐利得像在拆精密仪器，连呼吸都透着决赛局的紧张感。",
    analysis:
      "右上角镜子/窗边路人正在慢悠悠走跑步机，与前景两位剑拔弩张的桌足搭档形成奇妙的节奏对比：一个在养生，两个在拼命保卫段位分。",
    verdict: "这专注度要是拿去改 Bug，项目昨晚就上线了。",
  },
  // 12 [football] Knocked out face-down napping at workstation desk
  "0e6fc92cc2bd6aadd392c1c92c49a58a22de5edd7a287bfd8baade8967b225ee": {
    title: "《午间爆冲耗尽电量 · 工位待机》",
    tags: ["电量 0%", "科研人真实写照", "午休后遗症"],
    punchline:
      "三块屏幕还亮着文档与代码，眼镜整齐搁在桌边，人已经在工位上丝滑进入深度休眠——刚才在桌足台喊得多响，现在睡得就有多香。",
    analysis:
      "细节满满的真实工位：半瓶功能饮料、满桌草稿纸、随时待命的抽纸盒，再配上睡得极其安详的侧脸，完整闭环了“中午 G超激战 → 下午秒速断电”的 GAIR 经典日常。",
    verdict: "别吵，他在梦里复盘那脚为什么没弹反成功。",
  },
  // 13 [football] Back view at dual-monitor workstation (game left, feed right)
  "19a9071282b09c6277e7a1f6d59f756189d6316cd5ba4a041abdff25645d9b16": {
    title: "《双屏艺术：左江湖，右文档》",
    tags: ["工位偷拍", "双屏切换大师", "暗藏玄机"],
    punchline:
      "看似平静地在工位埋头苦干，仔细一看左屏已经飘起了暗黑武侠雨夜大片画风，右屏稳稳打开着正经网页，主打一个攻守兼备。",
    analysis:
      "这张图必须和图库里另一张 Steam 抓包截图连着看——毛绒绒的焦糖色外套背影透着松弛感，完美演绎什么叫“只要切屏够快，摸鱼就只是赛前动态视力训练”。",
    verdict: "左屏练反应速度，右屏做评估体系，两者合称全面发展。",
  },
  // 14 [football] Steam screenshot: 1 friend playing "余俊洁* 影之刃零"
  "a4b9798defe1978fbfe9f16399e917a67bd547f791fe12b433d8116d9f776788": {
    title: "《Steam 赛博抓包现场》",
    tags: ["铁证如山", "影之刃零", "在线抓现行"],
    punchline:
      "群里喊打球半天没人回，结果 Steam 好友列表直接弹出绿色高亮通缉令：“1 位好友正在玩 —— 余俊洁* 影之刃零”。",
    analysis:
      "没有一个多余像素，纯纯的公开处刑艺术！在充满球场照片的图库里突然混进一张 Steam 截图，信息密度与杀伤力堪比 VAR 裁判回放，当事人此刻只想立刻设置隐身。",
    verdict: "建议列入 G超纪律条例：练弹反可以，但不能只在《影之刃零》里练。",
  },
  // 15 [football] Ultra-low angle wide-stance giant shot looking up from floor
  "ee3a63425f53cff2931adb2c8558333b86b2d409630f0c19d2bfaaf347637238": {
    title: "《进击的桌足巨人：两米马步镇场》",
    tags: ["死亡仰拍视角", "大鹏展翅", "气场两米八"],
    punchline:
      "摄影师几乎趴在橙色地板上开启超广角仰拍，硬生生把普通扎马步拍出了“高达出击、脚踏双线、力拔山兮”的史诗压迫感。",
    analysis:
      "腰间系着外套、双腿跨度横跨半个球桌、顶棚灯带呈放射状汇聚到头顶——这构图放海报上可以直接当第二赛季《爆冲流》终极 Boss 宣传图。",
    verdict: "这下盘稳得像焊在了地板上，球桌晃了人都不会晃。",
  },
  // 16 [football] Covering nose/mouth laughing while guy behind grabs his head in disbelief
  "03f2cc64fff3bf7ce33ddea69e154f65d61892d71d8fc9eb6ef9313592c1f0c9": {
    title: "《捂嘴偷笑 × 抱头不敢信》",
    tags: ["经典双人表情包", "世界名画", "头皮发麻"],
    punchline:
      "前排黑衣大哥捂着嘴努力憋笑，后排兄弟已经双手抱头陷入彻底震撼，两人联手贡献了 G超史上最具张力的“反应二连”。",
    analysis:
      "右后方飞镖盘上还稳稳扎着三支蓝镖，仿佛在默默给这一回合的离谱程度打出了满分。只要看到有人抱头笑，你就知道刚刚绝对发生了一记违背物理常识的神仙球。",
    verdict: "一个负责偷笑，一个负责抱头，喜剧分工极其专业。",
  },
  // 17 [football] Meme with text: "防守goat现场教学"
  "61e4f6b33df32cdcb28441491883573481d02bef67192ba6f927d1d557d404f6": {
    title: "《防守 GOAT 的温柔微笑教学》",
    tags: ["官方自带字幕", "杀人诛心", "从容不迫"],
    punchline:
      "配文四个字“防守goat现场教学”已经气场全开，最绝的是本人一脸春风和煦的微笑，单手搭杆仿佛在说：“来，随便射，进一个算我输。”",
    analysis:
      "真正的高手从不咬牙切齿——球桌边缘还淡定放着耳机盒，整个姿态松弛得像在给新手做科普演示，属于那种赛后发进群里能让对面沉默三分钟的顶级表情包。",
    verdict: "笑着把你零封，还要顺手给你上一堂防守公开课。",
  },
  // 18 [football] B&W meme with text: "人与人的悲欢并不相通"
  "22ef34c8a4328dbae620c76c545cf5fdd959e87790ce95a86380458e9c18d22b": {
    title: "《黑白文艺复兴：悲欢并不相通》",
    tags: ["年度封神梗图", "黑白电影感", "五体投地"],
    punchline:
      "中间兄弟已经双膝跪地、五体投地彻底道心破碎；右边老哥却双拳冲天、仰天狂喜；左边站着的人淡定围观——鲁迅先生看了都要鼓掌的完美构图。",
    analysis:
      "黑白滤镜直接把一张午休随手拍升华为普利策体育摄影大奖！跪地者的绝望弧度与欢呼者的起跳高度形成 100% 镜像对称，这正是竞技体育最残酷也最迷人的瞬间。",
    verdict: "建议直接刻进 G超名人堂大门：胜者振臂高呼，败者当场谢幕。",
  },
  // 19 [football] Meme with text: "我们是冠军！"
  "a387ac58d194a00b32d768901cf5a8974680793eb688d5c573c8bccfd04c0649": {
    title: "《我们是冠军！》",
    tags: ["热血青春", "激情相拥", "夺冠既视感"],
    punchline:
      "两位搭档紧紧熊抱在一起笑到眼睛都没了，配上顶部大字“我们是冠军！”，不知道的还以为刚在欧冠决赛加时绝杀捧杯。",
    analysis:
      "虽然背景只是午休健身房和划船机，但脸上那种纯粹、发自内心的狂喜丝毫不输世界大赛——这就是 GAIR 超级联赛最珍贵的底色：小小球场，真的有大大热爱。",
    verdict: "不管对手是谁，只要赢下这一局，此刻我们就是世界冠军。",
  },
  // 20 [football] Meme with text: "豪到你了？" outdoors in hoodie + AW mask
  "b7077614e0f023e6cf2d762652f9554b374939285743d6496c12dc0163ab9254": {
    title: "《神秘大佬：豪到你了？》",
    tags: ["凡尔赛暴击", "Alan Walker 皮肤", "高能警告"],
    punchline:
      "黑卫衣兜帽拉满、印着经典 logo 的黑口罩遮面、双臂抱胸笑眼弯弯，胸前大红底白字直击灵魂——“豪到你了？”",
    analysis:
      "右下角电箱上的“有电危险”三角警示牌堪称神级环境伏笔！整张图从穿搭到眼神都写满了“我只是随便打打就赢了，你不会破防了吧”的顶级拉仇恨气质。",
    verdict: "前方高能预警：请勿在连败后直视这张图片，容易血压飙升。",
  },
  // 21 [badminton] Vertical basketball jump shot in badminton hall!
  "80d62abc81d0cd9b110b27b1a907cb2c01a66a697744083e844aa9cad3000d95": {
    title: "《羽毛球图库惊现“垂直干拔”》",
    tags: ["走错片场", "滞空教科书", "跨界整活"],
    punchline:
      "点开 GB 羽毛球图库，满心期待欣赏网前放网与大力杀球，结果赫然跳出一张笔直起跳、高弧度出手的标准篮球跳投！",
    analysis:
      "最妙的是这记起跳身姿笔直得像发射中的火箭，双脚离地高度惊人，脚下踩的还确实是羽毛球场边线——堪称“既然场馆都租了，多练一项不亏”的跨界代表作。",
    verdict: "GB 联赛隐藏新项目预告：下赛季难道要开“G篮”？",
  },
  // 22 [badminton] Blue sweater leaping high with arm extended, cyan partner ready behind
  "5bf36fe4360ef2237b300cb7d74a58162a1a2a0c340340ab5019da2760286aa2": {
    title: "《芭蕾式起跳高远球》",
    tags: ["轻盈起飞", "全力舒展", "搭档护法"],
    punchline:
      "前排蓝衣选手单脚腾空、右臂无限拉长直指天花板，动作舒展得自带芭蕾舞剧特效，甚至因为伸得太拼把衣摆都拉起了几厘米。",
    analysis:
      "后排青衣搭档扎着稳健防守步仰望天空，眼神紧锁空中的白色羽毛球，一人负责优雅起飞，一人负责地面兜底，双打默契在这一帧具象化了。",
    verdict: "只要跳得够高、手伸得够长，没有接不到的高远球。",
  },
  // 23 [badminton] Mint sweatshirt dramatic fencing lunge while black jacket partner smiles watching
  "e0da7750163917c1c6339ef05a228a28d1c654130e2339960d67bd7d8ec8b1aa": {
    title: "《箭步救球 × 旁观吃瓜》",
    tags: ["击剑式跨步", "劳逸结合", "搭档对比"],
    punchline:
      "右边薄荷绿卫衣选手迈出近两米大跨步上演“击剑式极限救球”，左边黑衣队友却双腿站直、面带慈祥微笑，像在场边欣赏舞台剧。",
    analysis:
      "双打经典分工定律再次应验：场上永远有一个人在拼命跑图燃烧卡路里，另一个人在旁边负责情绪价值、鼓掌喝彩以及准备喊“好球！”。",
    verdict: "一个人打出了奥运决赛的步幅，另一个人看出了观演 VIP 的松弛。",
  },
  // 24 [badminton] Cyan hoodie mid-sprint twisted back mouth wide open in panic
  "32ecd28e2fcce778ac38d71f4c2aa2fd5999a2d10815ec747466740fe2d30cfb": {
    title: "《回头惊恐：这球怎么飞我脸上了！》",
    tags: ["GB 年度表情包", "灵魂出窍", "逃命式走位"],
    punchline:
      "青衣选手一边狂奔一边扭身回望，球拍抱在胸前、嘴巴张成 O 字形，整个人写满了“救命！这记杀球冲我来的！”的极度震惊。",
    analysis:
      "左上角灰衣路人正云淡风轻地仰头散步，右侧搭档淡定站立，唯独 C 位男主用极其扭曲的逃跑身法贡献了全站含金量最高的动态表情包——每一帧都是喜剧天才。",
    verdict: "球还没落地，表情包就已经先拿下了全场 MVP。",
  },
  // 25 [badminton] Black jacket flying jump smash vs mint partner ultra-low crouch
  "fc6506d83d5e3791237cd3424d68f4b09871f5bda767294a18d7fbd1eeee53f5": {
    title: "《一个起飞扣杀，一个原地深蹲》",
    tags: ["高低差拉满", "空地协同", "物理折叠"],
    punchline:
      "右边黑衣选手腾空而起，在半空拧成一道闪电准备重炮扣杀；左边搭档直接把自己折叠成超低底盘“防守炮台”，生怕被队友误伤。",
    analysis:
      "整张照片构图极其工整：一高一低、一动一静，一个快飞出画面顶部，一个稳稳贴近地板——完美展示了 GB 双打“前场低伏躲炮火、后场起跳轰重炮”的教科书配合。",
    verdict: "前排：你只管起飞，我先蹲下保命！",
  },
};

const FALLBACK_BY_LEAGUE: Record<GalleryLeague, GalleryMemeAnalysis> = {
  football: {
    title: "《G超桌足 · 新鲜出炉名场面》",
    tags: ["最新上传", "桌足高光", "等待封神"],
    punchline:
      "刚入库的 G超桌足最新抓拍！球桌上的每一秒都可能诞生下一张全员流传的经典表情包。",
    analysis:
      "无论是电光火石的弹反爆冲，还是场边笑到直不起腰的破防瞬间，都已经被永久收录进 GAIR 超级联赛图库档案。",
    verdict: "下一张封神梗图，也许就藏在这局对决里。",
  },
  badminton: {
    title: "《GB 羽毛球 · 球场鲜活瞬间》",
    tags: ["最新上传", "挥拍高光", "球场抓拍"],
    punchline:
      "刚加入 GB 羽毛球图库的新鲜瞬间！11 分一局决胜的节奏里，每拍都在上演极限救球与默契配合。",
    analysis:
      "从轻盈起跳到极限跨步，球场上的高燃与爆笑同样值得被定格留念，点击右下角可放大细看高清原图。",
    verdict: "挥拍上场来真的，顺便再产几张神级表情包。",
  },
};

export function getGalleryMemeAnalysis(
  item: HomeGalleryItem,
): GalleryMemeAnalysis {
  return GALLERY_MEME_ANALYSES[item.id] ?? FALLBACK_BY_LEAGUE[item.league];
}

export function buildRandomOrder(
  length: number,
  avoidFirstIndex?: number,
  random: () => number = Math.random,
): number[] {
  if (length <= 0) return [];
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  if (
    length > 1 &&
    avoidFirstIndex !== undefined &&
    order[0] === avoidFirstIndex
  ) {
    const swapIdx = 1 + Math.floor(random() * (length - 1));
    const tmp = order[0];
    order[0] = order[swapIdx];
    order[swapIdx] = tmp;
  }
  return order;
}
