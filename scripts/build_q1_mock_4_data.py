"""ユーザー提供の英検1級「模試 第4回」をQ1形式へ変換する。"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ROUND_ID = "mock-4"


QUESTIONS = [
    {"stem": "One of the ( ) of starting a business with friends is that personal feelings can sometimes interfere with making objective business decisions.", "choices": ["implements", "curfews", "pitfalls", "grouches"], "answerIndex": 2, "translation": "友人と一緒に事業を始めることの落とし穴の一つは、個人的な感情が客観的な経営判断の妨げになることがある点だ。"},
    {"stem": "The former CEO is now on trial for theft. He faces charges for ( ) stealing over one million dollars in company assets.", "choices": ["allegedly", "unabashedly", "nonchalantly", "ascetically"], "answerIndex": 0, "translation": "その元CEOは現在、窃盗の罪で裁判を受けている。会社の資産100万ドル以上を盗んだとされ、起訴されている。"},
    {"stem": "A: I didn't know your brother likes wine.\nB: Are you kidding? He's a ( ). He can tell you a whole bunch of things about a wine just by taking one sip of it.", "choices": ["novice", "connoisseur", "pushover", "bigot"], "answerIndex": 1, "translation": "A：あなたのお兄さんがお酒好きだとは知らなかった。\nB：冗談でしょう？彼は目利きなんだ。ワインを一口飲むだけで、そのワインについていろいろなことが分かるんだよ。"},
    {"stem": "Hank is a popular teacher because he is good at creating a ( ) with students. He often has lunch with them or helps them with their homework after school.", "choices": ["stampede", "graft", "convergence", "rapport"], "answerIndex": 3, "translation": "ハンクは生徒たちと親密な関係を築くのが上手なので人気のある教師だ。生徒たちとよく昼食を共にしたり、放課後に宿題を手伝ったりする。"},
    {"stem": "Although the company claimed that scientific studies had shown their weight-loss pill to be effective, it turned out that they had only conducted ( ) experiments that didn't really mean anything.", "choices": ["evocative", "ponderous", "bogus", "rowdy"], "answerIndex": 2, "translation": "その会社は減量薬が効果的だと科学的研究で示されたと主張したが、実際には意味のない偽の実験しか行っていなかったことが分かった。"},
    {"stem": "Amy did not want to participate when her biology class was ( ) frogs. She said that looking at the frogs' internal organs made her feel sick.", "choices": ["surmising", "dissecting", "swilling", "muddling"], "answerIndex": 1, "translation": "生物の授業でカエルを解剖することになったとき、エイミーは参加したくなかった。カエルの内臓を見ると気分が悪くなると言った。"},
    {"stem": "A: I don't mean to ( ), but how did you manage to buy such an expensive house?\nB: I'd rather not talk about my personal finances.", "choices": ["pry", "cogitate", "writhe", "consort"], "answerIndex": 0, "translation": "A：詮索するつもりはないのですが、どうやってそんな高い家を買ったのですか？\nB：個人的な経済事情については話したくありません。"},
    {"stem": "Officials panicked last Thursday when a gorilla escaped from the zoo. Luckily, he hadn't gone too far, and they were able to find and capture him in the ( ) of the parking lot.", "choices": ["complacency", "echelon", "vicinity", "rupture"], "answerIndex": 2, "translation": "先週の木曜日、動物園からゴリラが逃げ出し、職員たちは慌てた。幸い、ゴリラは遠くへ行っておらず、駐車場の近辺で見つけて捕まえることができた。"},
    {"stem": "A: I can't wait much longer to receive money for my medical bills.\nB: I'm sorry for the delay. I'll try to see if we can ( ) the processing of your insurance claim.", "choices": ["disdain", "expedite", "shackle", "annex"], "answerIndex": 1, "translation": "A：医療費のお金を受け取るのをこれ以上長く待てません。\nB：遅れていてすみません。保険請求の処理を早められないか確認してみます。"},
    {"stem": "Reynold was ( ) when he didn't get the scholarship. Without it, he wouldn't be able to complete the doctoral degree that he'd spent years working for.", "choices": ["agnostic", "distraught", "enamored", "remedial"], "answerIndex": 1, "translation": "レイノルドは奨学金を得られず、ひどく取り乱した。それがなければ、何年も努力してきた博士号を取得できないからだ。"},
    {"stem": "When Chris had to borrow money from Scott, they didn't write out a contract or anything like that. There was a ( ) understanding that Chris would pay Scott back as soon as he could.", "choices": ["tacit", "tangible", "rueful", "devout"], "answerIndex": 0, "translation": "クリスがスコットからお金を借りたとき、二人は契約書などを書かなかった。クリスができるだけ早くスコットに返すという暗黙の了解があった。"},
    {"stem": "You wouldn't have known that Lloyd had won the lottery by looking at his ( ) face. He didn't seem to be feeling any emotion at all.", "choices": ["cordial", "impassive", "elaborate", "flippant"], "answerIndex": 1, "translation": "ロイドの無表情な顔を見ても、彼が宝くじに当たったとは分からなかった。彼はまったく感情を表していないようだった。"},
    {"stem": "Victor enjoyed getting drinks with his coworkers after work on Thursdays. It was nice to exchange some friendly ( ) with them, not like the serious discussions they had at work.", "choices": ["banter", "jeer", "indolence", "boon"], "answerIndex": 0, "translation": "ビクターは木曜日の仕事帰りに同僚と飲みに行くのを楽しんでいた。職場でする真剣な議論とは違い、同僚と気軽な冗談を交わせるのは楽しかった。"},
    {"stem": "Bella grew up in the desert, so she was not at all accustomed to the climate of the tropical island, where it rained every day. It was quite different than her ( ) hometown.", "choices": ["dormant", "pivotal", "resilient", "arid"], "answerIndex": 3, "translation": "ベラは砂漠で育ったため、毎日雨が降る熱帯の島の気候にはまったく慣れていなかった。それは彼女の乾燥した故郷とは大きく異なっていた。"},
    {"stem": "The rebels' attempt to overthrow the government was ( ) by the army, and most of the group's leaders were arrested.", "choices": ["rectified", "deployed", "esteemed", "thwarted"], "answerIndex": 3, "translation": "反政府勢力による政権転覆の試みは軍によって阻止され、グループの指導者の大半が逮捕された。"},
    {"stem": "Robson Tech claimed that they had no responsibility to finish the contract, as it had already been ( ) when their client broke the Terms of Agreement.", "choices": ["flapped", "nullified", "solicited", "pawned"], "answerIndex": 1, "translation": "顧客が契約条件に違反した時点ですでに契約は無効になっていたため、ロブソン・テックは契約を完了する責任はないと主張した。"},
    {"stem": "The diplomat was quick to organize a peaceful dialogue between the two countries' leaders, and many say that his efforts were key to ( ) a war.", "choices": ["depreciating", "clobbering", "relishing", "averting"], "answerIndex": 3, "translation": "その外交官は両国の指導者間の平和的な対話をすぐに組織し、多くの人が彼の努力は戦争を回避する鍵だったと述べている。"},
    {"stem": "The plot of the play wasn't bad. Rather, the ( ) of the criticism has been directed at the poor performance of the actors.", "choices": ["sloth", "tremor", "obscurity", "brunt"], "answerIndex": 3, "translation": "その劇の筋書きは悪くなかった。むしろ、批判の矛先の大部分は俳優たちの下手な演技に向けられている。"},
    {"stem": "Ashley couldn't believe it when the doctor told her that she'd only been taking a ( ), not a weight-loss pill. She had lost ten pounds, and she had done it without the help of any medicine.", "choices": ["placebo", "rebound", "salvo", "transgression"], "answerIndex": 0, "translation": "アシュリーは、減量薬ではなく偽薬を飲んでいただけだと医師から聞かされ、信じられなかった。彼女は10ポンド痩せており、薬の助けなしにそれを達成していた。"},
    {"stem": "Molly was one of the prettiest, most popular girls in her school, and she always had a number of boys ( ) for her attention.", "choices": ["vying", "proliferating", "soaring", "snowballing"], "answerIndex": 0, "translation": "モリーは学校で最もかわいく人気のある女子の一人で、いつも何人もの男子が彼女の気を引こうと競い合っていた。"},
    {"stem": "When Vanessa was in high school, she was ( ) with her first boyfriend. She wrote him love letters every day, and she spent all of her time thinking about him.", "choices": ["invigorated", "dredged", "saturated", "infatuated"], "answerIndex": 3, "translation": "ヴァネッサは高校生のころ、初めてのボーイフレンドに夢中だった。毎日彼にラブレターを書き、ずっと彼のことを考えていた。"},
    {"stem": "A: You have work tomorrow? But tomorrow's Saturday.\nB: Yeah, I got ( ) working by my boss. He said that he's under a lot of pressure to finish this project by Monday.", "choices": ["roped into", "factored in", "frowned on", "smoothed down"], "answerIndex": 0, "translation": "A：明日仕事なの？でも明日は土曜日だよ。\nB：そうなんだ。上司に無理やり仕事に引き込まれた。月曜日までにこの計画を終えるよう大きなプレッシャーを受けているらしい。"},
    {"stem": "The new mayor had promised to ( ) corruption in the local government, and within two months of being elected, five city officials were arrested.", "choices": ["fire up", "root out", "lap up", "pass down"], "answerIndex": 1, "translation": "新市長は地方政府の汚職を根絶すると約束し、当選から2か月以内に5人の市職員が逮捕された。"},
    {"stem": "Peter ( ) his back trying to lift the refrigerator by himself. Now he's in so much pain that he can hardly walk.", "choices": ["threw out", "scraped together", "pushed up", "forced back"], "answerIndex": 0, "translation": "ピーターは一人で冷蔵庫を持ち上げようとして腰を痛めた。今は痛みがひどく、ほとんど歩けない。"},
    {"stem": "The detective was finally able to solve the case after ( ) the large number of clues that he had uncovered in his investigation.", "choices": ["heading up", "piecing together", "punching out", "stirring up"], "answerIndex": 1, "translation": "その探偵は、捜査で見つけた大量の手がかりをつなぎ合わせた後、ついに事件を解決できた。"},
]


DETAILS = {
    "implements": ("道具、器具", "名詞", "The laboratory purchased new implements for handling delicate samples.", "その研究室は繊細な試料を扱うための新しい器具を購入した。"),
    "curfews": ("門限、外出禁止令", "名詞", "The city imposed curfews after the severe storm.", "その都市は激しい嵐の後、外出禁止令を出した。"),
    "pitfalls": ("落とし穴、潜在的な問題", "名詞", "The guide explains the common pitfalls of investing online.", "そのガイドはオンライン投資のよくある落とし穴を説明している。"),
    "grouches": ("不平を言う人、不満", "名詞", "The office grouches complained about every change in the schedule.", "その職場の不平屋たちは、予定の変更すべてに不満を言った。"),
    "allegedly": ("申し立てによれば、伝えられるところでは", "副詞", "The official allegedly accepted money from the contractor.", "その役人は請負業者から金を受け取ったとされている。"),
    "unabashedly": ("臆面もなく、恥じずに", "副詞", "He unabashedly asked for a second helping of dessert.", "彼は臆面もなくデザートのおかわりを頼んだ。"),
    "nonchalantly": ("平然と、無頓着に", "副詞", "She nonchalantly mentioned that she had won the contest.", "彼女はコンテストに勝ったことを平然と口にした。"),
    "ascetically": ("禁欲的に", "副詞", "The monk lived ascetically in a small mountain hut.", "その修道士は山の小屋で禁欲的に暮らした。"),
    "novice": ("初心者", "名詞", "As a novice, he made several mistakes with the equipment.", "初心者だった彼は、その機器の扱いでいくつかミスをした。"),
    "connoisseur": ("鑑識家、目利き", "名詞", "The connoisseur recognized the painting's value immediately.", "その目利きはその絵の価値をすぐに見抜いた。"),
    "pushover": ("押しに弱い人、簡単に負かせる人", "名詞", "Do not mistake her kindness for being a pushover.", "彼女の親切さを押しに弱いことと勘違いしてはいけない。"),
    "bigot": ("偏狭な人、偏見を持つ人", "名詞", "The speaker criticized the bigot who refused to listen to other views.", "その話し手は、他人の意見を聞こうとしない偏狭な人を批判した。"),
    "stampede": ("群衆の殺到、暴走", "名詞", "The sudden noise caused a stampede near the stadium entrance.", "突然の音がスタジアム入口付近で群衆の殺到を引き起こした。"),
    "graft": ("汚職、贈収賄", "名詞", "The investigation uncovered graft in the construction industry.", "その調査は建設業界の汚職を明らかにした。"),
    "convergence": ("収束、合流", "名詞", "The convergence of the two rivers creates a wide basin.", "二つの川の合流によって広い盆地ができている。"),
    "rapport": ("親密な関係、意思疎通", "名詞", "The counselor quickly established a good rapport with the student.", "そのカウンセラーはすぐに生徒とよい関係を築いた。"),
    "evocative": ("喚起する、印象的な", "形容詞", "The evocative photograph brought back memories of my childhood.", "その印象的な写真は子どものころの記憶を呼び起こした。"),
    "ponderous": ("重々しい、退屈で扱いにくい", "形容詞", "The ponderous report was difficult for ordinary readers to finish.", "その重苦しく退屈な報告書は、一般の読者には読み終えるのが難しかった。"),
    "bogus": ("偽の、インチキな", "形容詞", "The website was selling bogus tickets for the concert.", "そのウェブサイトはコンサートの偽のチケットを販売していた。"),
    "rowdy": ("騒々しい、乱暴な", "形容詞", "The security guards removed a group of rowdy fans.", "警備員たちは騒々しいファンの一団を退場させた。"),
    "surmising": ("推測すること", "動詞", "She was only surmising about the reason for his absence.", "彼女は彼が欠席した理由を推測していただけだった。"),
    "dissecting": ("解剖する", "動詞", "The students were dissecting a flower in biology class.", "生徒たちは生物の授業で花を解剖していた。"),
    "swilling": ("がぶ飲みする", "動詞", "The thirsty hikers were swilling water from their bottles.", "喉の渇いたハイカーたちはボトルの水をがぶ飲みしていた。"),
    "muddling": ("混乱させる、混ぜ合わせる", "動詞", "Muddling the two instructions will only cause mistakes.", "二つの指示を混同すると、間違いを招くだけだ。"),
    "pry": ("詮索する", "動詞", "I do not want to pry into your private affairs.", "あなたの私事を詮索したくはない。"),
    "cogitate": ("熟考する", "動詞", "He went for a walk to cogitate on the difficult decision.", "彼は難しい決断について熟考するため散歩に出た。"),
    "writhe": ("身もだえする", "動詞", "The injured animal writhed in pain on the ground.", "けがをした動物は地面で痛みに身もだえした。"),
    "consort": ("交際する、付き合う", "動詞", "The prince was warned not to consort with criminals.", "王子は犯罪者と付き合わないよう警告された。"),
    "complacency": ("自己満足、油断", "名詞", "Complacency can be dangerous after a few successful years.", "数年うまくいった後の油断は危険なことがある。"),
    "echelon": ("階層、段階", "名詞", "She reached the highest echelon of the organization.", "彼女はその組織の最高階層に到達した。"),
    "vicinity": ("近辺", "名詞", "There are several cafés in the vicinity of the station.", "駅の近辺にはカフェがいくつかある。"),
    "rupture": ("破裂、断絶", "名詞", "The rupture in the pipe flooded the basement.", "パイプの破裂で地下室が水浸しになった。"),
    "disdain": ("軽蔑する", "動詞", "She disdains people who abuse their authority.", "彼女は権力を乱用する人々を軽蔑している。"),
    "expedite": ("促進する、処理を早める", "動詞", "The clerk expedited the delivery because the customer was leaving town.", "店員は顧客が町を離れる予定だったので配送を早めた。"),
    "shackle": ("束縛する、足かせを付ける", "動詞", "Debt can shackle a family for many years.", "借金は家族を何年も束縛することがある。"),
    "annex": ("併合する、付属させる", "動詞", "The city voted to annex the neighboring village.", "その市は隣接する村を併合することを採決した。"),
    "agnostic": ("不可知論の、不可知論者", "形容詞", "He remained agnostic about whether the rumor was true.", "そのうわさが本当かどうかについて、彼は判断を保留した。"),
    "distraught": ("ひどく取り乱した", "形容詞", "The distraught parent called the police immediately.", "ひどく取り乱した親はすぐに警察へ電話した。"),
    "enamored": ("夢中になった、気に入った", "形容詞", "The visitors were enamored with the quiet village.", "訪問者たちは静かな村をとても気に入った。"),
    "remedial": ("補習の、改善の", "形容詞", "The school offers remedial classes in mathematics.", "その学校は数学の補習授業を行っている。"),
    "tacit": ("暗黙の", "形容詞", "There was a tacit agreement not to discuss the incident.", "その出来事について話さないという暗黙の了解があった。"),
    "tangible": ("具体的で触れられる", "形容詞", "The project has produced tangible benefits for local residents.", "その計画は地元住民に具体的な利益をもたらした。"),
    "rueful": ("後悔している、悲しげな", "形容詞", "He gave a rueful smile after breaking the vase.", "花瓶を割った後、彼は後悔したように微笑んだ。"),
    "devout": ("敬虔な", "形容詞", "She is a devout member of her local church.", "彼女は地元の教会の敬虔な信者だ。"),
    "cordial": ("心のこもった、友好的な", "形容詞", "The two leaders exchanged cordial greetings.", "二人の指導者は心のこもった挨拶を交わした。"),
    "impassive": ("無表情な、感情を示さない", "形容詞", "The witness remained impassive throughout the trial.", "その証人は裁判中ずっと無表情だった。"),
    "elaborate": ("精巧な、詳しい", "形容詞", "The museum displayed an elaborate mechanical clock.", "その博物館には精巧な機械時計が展示されていた。"),
    "flippant": ("軽薄な、ぞんざいな", "形容詞", "His flippant response upset the people in the room.", "彼の軽薄な返答はその場にいた人々を怒らせた。"),
    "banter": ("冗談の言い合い", "名詞", "Friendly banter made the long meeting more enjoyable.", "気軽な冗談の言い合いで、長い会議がより楽しくなった。"),
    "jeer": ("あざけり、嘲笑", "名詞", "The player ignored the jeer from the opposing fans.", "その選手は相手チームのファンからの嘲笑を無視した。"),
    "indolence": ("怠惰", "名詞", "His indolence kept him from completing the project on time.", "彼の怠惰のため、計画を期限までに終えられなかった。"),
    "boon": ("恩恵、ありがたいもの", "名詞", "The new train line has been a boon to commuters.", "新しい鉄道路線は通勤者にとって大きな恩恵になった。"),
    "dormant": ("休眠中の、活動していない", "形容詞", "The volcano has been dormant for centuries.", "その火山は何世紀も活動を休止している。"),
    "pivotal": ("極めて重要な", "形容詞", "Her advice played a pivotal role in my decision.", "彼女の助言は私の決断で極めて重要な役割を果たした。"),
    "resilient": ("回復力のある、立ち直りの早い", "形容詞", "Children can be remarkably resilient after difficult experiences.", "子どもたちはつらい経験の後でも驚くほど立ち直りが早いことがある。"),
    "arid": ("乾燥した", "形容詞", "Few crops can survive in such an arid region.", "そのように乾燥した地域では、ほとんど作物が育たない。"),
    "rectified": ("訂正した、是正した", "動詞", "The company rectified the error in the report.", "その会社は報告書の誤りを訂正した。"),
    "deployed": ("配置した、展開した", "動詞", "The army deployed extra units near the border.", "軍は国境付近に追加部隊を配置した。"),
    "esteemed": ("尊敬された、評価された", "動詞", "The professor is esteemed by students around the world.", "その教授は世界中の学生から尊敬されている。"),
    "thwarted": ("妨げた、阻止した", "動詞", "The police thwarted the robbery before anyone was hurt.", "警察は誰もけがをする前に強盗を阻止した。"),
    "flapped": ("ばたついた", "動詞", "The loose sign flapped in the strong wind.", "固定のゆるい看板が強風でばたついた。"),
    "nullified": ("無効にした", "動詞", "The court nullified the unfair contract.", "裁判所はその不公平な契約を無効にした。"),
    "solicited": ("求めた、勧誘した", "動詞", "The charity solicited donations from local businesses.", "その慈善団体は地元企業に寄付を募った。"),
    "pawned": ("質に入れた", "動詞", "He pawned his watch to pay the unexpected bill.", "彼は予想外の請求を払うため時計を質に入れた。"),
    "depreciating": ("価値を下げる、減価する", "動詞", "The company is depreciating the equipment over five years.", "その会社は5年間で設備を減価償却している。"),
    "clobbering": ("めちゃくちゃに打ち負かす", "動詞", "The champion is clobbering every opponent this season.", "その王者は今季、対戦相手を次々に圧倒している。"),
    "relishing": ("楽しむ、味わう", "動詞", "She was relishing the chance to perform on a large stage.", "彼女は大きな舞台で演じる機会を楽しんでいた。"),
    "averting": ("回避する", "動詞", "Early action is essential for averting a larger crisis.", "より大きな危機を回避するには早めの行動が不可欠だ。"),
    "sloth": ("怠惰、ナマケモノ", "名詞", "His habit of sleeping late was a sign of sloth.", "寝坊する彼の習慣は怠惰の表れだった。"),
    "tremor": ("震え", "名詞", "A small tremor shook the windows during the night.", "夜の間に小さな揺れが窓を震わせた。"),
    "obscurity": ("無名、曖昧さ", "名詞", "The writer emerged from obscurity after the novel became a hit.", "その作家は小説がヒットした後、無名の状態から世に出た。"),
    "brunt": ("矢面、最大の打撃", "名詞", "The coastal towns bore the brunt of the storm.", "沿岸の町々がその嵐の最大の打撃を受けた。"),
    "placebo": ("偽薬", "名詞", "Half of the patients received a placebo in the study.", "その研究では患者の半数が偽薬を受け取った。"),
    "rebound": ("反動、回復", "名詞", "The company expects a rebound in sales next year.", "その会社は来年の売上回復を見込んでいる。"),
    "salvo": ("一斉射撃、連発", "名詞", "The team opened the debate with a salvo of sharp questions.", "そのチームは鋭い質問の連発で討論を始めた。"),
    "transgression": ("違反、罪", "名詞", "The school treated cheating as a serious transgression.", "その学校はカンニングを重大な違反として扱った。"),
    "vying": ("競い合う", "動詞", "Several companies are vying for the government contract.", "いくつかの会社が政府契約をめぐって競い合っている。"),
    "proliferating": ("急増する", "動詞", "False stories are proliferating on social media.", "ソーシャルメディア上で偽の情報が急増している。"),
    "soaring": ("急上昇する、高く舞い上がる", "動詞", "Soaring energy prices are hurting small businesses.", "急上昇するエネルギー価格が中小企業を苦しめている。"),
    "snowballing": ("雪だるま式に増える", "動詞", "The costs kept snowballing after the construction began.", "建設が始まった後、費用は雪だるま式に増え続けた。"),
    "invigorated": ("活気づけられた", "形容詞", "A short walk left her feeling invigorated.", "短い散歩で彼女は活力を取り戻した。"),
    "dredged": ("さらった、掘り起こした", "動詞", "The workers dredged the river to remove the mud.", "作業員たちは泥を取り除くため川をさらった。"),
    "saturated": ("浸透した、飽和した", "形容詞", "The market is saturated with similar products.", "市場は似たような製品で飽和している。"),
    "infatuated": ("夢中になった", "形容詞", "He became infatuated with the singer after seeing her perform.", "彼は彼女の演奏を見て、その歌手に夢中になった。"),
    "roped into": ("無理に引き込まれた", "熟語", "I was roped into helping with the office party.", "私はオフィスのパーティーの手伝いに無理やり引き込まれた。"),
    "factored in": ("考慮に入れた", "熟語", "The planner factored in the possibility of heavy traffic.", "その計画担当者は激しい渋滞の可能性を考慮に入れた。"),
    "frowned on": ("快く思わなかった、認めなかった", "熟語", "The school frowned on students using phones in class.", "その学校は授業中に生徒が携帯電話を使うことを認めなかった。"),
    "smoothed down": ("なだめた、平らにした", "熟語", "The manager smoothed down the disagreement between the employees.", "マネージャーは従業員同士の対立をなだめた。"),
    "fire up": ("奮起させる、活気づける", "熟語", "The coach's speech fired up the team before the final.", "コーチのスピーチは決勝を前にチームを奮起させた。"),
    "root out": ("根絶する、見つけ出す", "熟語", "The audit was designed to root out financial fraud.", "その監査は金融上の不正を根絶するために設計された。"),
    "lap up": ("喜んで受け入れる、がつがつ食べる", "熟語", "The audience lapped up the comedian's latest jokes.", "観客はそのコメディアンの最新の冗談を喜んで受け入れた。"),
    "pass down": ("受け継がせる、伝える", "熟語", "The recipe was passed down through four generations.", "そのレシピは4世代にわたって受け継がれてきた。"),
    "threw out": ("痛めた、捨てた", "熟語", "He threw out his back while moving a heavy desk.", "彼は重い机を動かしているときに腰を痛めた。"),
    "scraped together": ("かき集めた", "熟語", "They scraped together enough money to repair the roof.", "彼らは屋根を修理するためのお金をかき集めた。"),
    "pushed up": ("押し上げた", "熟語", "The shortage pushed up the price of fresh vegetables.", "不足によって新鮮な野菜の価格が押し上げられた。"),
    "forced back": ("押し戻した", "熟語", "The defenders forced back the attackers at the bridge.", "守備側は橋で攻撃側を押し戻した。"),
    "heading up": ("率いる", "熟語", "A senior engineer is heading up the safety investigation.", "上級技術者が安全調査を率いている。"),
    "piecing together": ("つなぎ合わせて理解する", "熟語", "The detective was piecing together the events of the night.", "探偵はその夜の出来事をつなぎ合わせていた。"),
    "punching out": ("殴り倒す、退勤打刻する", "熟語", "The guard stopped the thief by punching him out.", "警備員は泥棒を殴り倒して止めた。"),
    "stirring up": ("引き起こす、かき立てる", "熟語", "The article was accused of stirring up public anger.", "その記事は世論の怒りをかき立てたとして非難された。"),
}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build() -> tuple[dict, dict]:
    if len(QUESTIONS) != 25:
        raise ValueError("模試 第4回は25問である必要があります")
    choices = [choice for question in QUESTIONS for choice in question["choices"]]
    if len(choices) != len(set(choices)):
        raise ValueError("選択肢に重複があります")
    missing = sorted(set(choices) - set(DETAILS))
    if missing:
        raise ValueError(f"語句情報がありません: {missing}")

    meta = {
        "grade": "英検1級",
        "round": ROUND_ID,
        "section": "Reading 大問1（語句空所補充）",
        "source": "ユーザー提供の模試原稿（模試 第4回）を学習用JSONへ構造化",
        "counts": {"words": 84, "idioms": 16, "total": 100},
    }
    question_data = {
        "meta": meta,
        "questions": [
            {"q": index, **question}
            for index, question in enumerate(QUESTIONS, start=1)
        ],
    }
    words = []
    idioms = []
    for q, question in enumerate(QUESTIONS, start=1):
        for index, choice in enumerate(question["choices"]):
            meaning, pos, example, example_translation = DETAILS[choice]
            item = {
                "q": q,
                "is_answer": index == question["answerIndex"],
                "meaning": meaning,
                "example": example,
                "exampleTranslation": example_translation,
                "pos": pos,
            }
            if " " in choice:
                item["phrase"] = choice
                idioms.append(item)
            else:
                item["word"] = choice
                words.append(item)
    if (len(words), len(idioms)) != (84, 16):
        raise ValueError(f"語句数が想定と違います: words={len(words)}, idioms={len(idioms)}")
    vocab_data = {"meta": meta, "words": words, "idioms": idioms}
    return vocab_data, question_data


def main() -> None:
    vocab, questions = build()
    write_json(DATA_DIR / "vocab_1_mock-4.json", vocab)
    write_json(DATA_DIR / "questions_1_mock-4.json", questions)
    print("mock-4: 25 questions / 100 items (84 words, 16 idioms)")


if __name__ == "__main__":
    main()
