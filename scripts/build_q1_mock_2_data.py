"""ユーザー提供の英検1級「模試 第2回」をQ1形式へ変換する。"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ROUND_ID = "mock-2"


QUESTIONS = [
    {
        "stem": "The university's well-known literature program is often ( ) as being the best in the country.",
        "choices": ["dispatched", "trampled", "touted", "toppled"],
        "answerIndex": 2,
        "translation": "その大学の有名な文学プログラムは、国内最高のものだとよく称賛されている。",
    },
    {
        "stem": "The teacher explained that children are ( ) curious, and that it's easy to teach them if you just present information in a way that will interest them.",
        "choices": ["bluntly", "innately", "astutely", "devoutly"],
        "answerIndex": 1,
        "translation": "教師は、子どもは生まれつき好奇心が強く、興味を引く形で情報を示せば教えるのは簡単だと説明した。",
    },
    {
        "stem": "The company offers free IT classes for any employees that are interested in ( ) their computer skills.",
        "choices": ["streaking", "canvassing", "impelling", "honing"],
        "answerIndex": 3,
        "translation": "その会社は、コンピューター技能を磨くことに関心のある従業員に無料のIT講座を提供している。",
    },
    {
        "stem": "Jonah's doctors were ( ) when his cancer suddenly disappeared. They couldn't think of any scientific explanation for it.",
        "choices": ["rigorous", "perplexed", "insurgent", "sedate"],
        "answerIndex": 1,
        "translation": "ジョナのがんが突然消えたとき、医師たちは困惑した。科学的な説明を思いつけなかった。",
    },
    {
        "stem": "Roger's first business was a failure, and it left him ( ). Still, he didn't give up, and he went from having no money to being one of the richest men in the country.",
        "choices": ["palliative", "sinister", "colloquial", "destitute"],
        "answerIndex": 3,
        "translation": "ロジャーの最初の事業は失敗し、彼は無一文になった。それでも諦めず、金のない状態から国内有数の富豪になった。",
    },
    {
        "stem": "Very few accountants know all of the ( ) rules and regulations regarding international tax laws, so it is difficult to find an expert who specializes in this area.",
        "choices": ["arcane", "inclement", "benevolent", "covetous"],
        "answerIndex": 0,
        "translation": "国際的な税法に関する難解な規則と規制をすべて知る会計士はほとんどいないので、この分野の専門家を見つけるのは難しい。",
    },
    {
        "stem": "A: Susan, I heard that you're planning to quit and move to Australia. Is there anything I can do to ( ) you?\nB: I'm sorry, Mrs. Williams. Going to Australia has been a dream of mine for a long time.",
        "choices": ["dissuade", "straddle", "contravene", "infiltrate"],
        "answerIndex": 0,
        "translation": "A：スーザン、仕事を辞めてオーストラリアへ引っ越すつもりだと聞いたよ。あなたを思いとどまらせるために私にできることはある？\nB：すみません、ウィリアムズさん。オーストラリアへ行くのはずっと私の夢だったんです。",
    },
    {
        "stem": "Experts say that the merging of these two huge companies is the ( ) of years of negotiating and planning.",
        "choices": ["perforation", "culmination", "adulation", "abomination"],
        "answerIndex": 1,
        "translation": "専門家によると、この2つの巨大企業の合併は、何年にもわたる交渉と計画の集大成だという。",
    },
    {
        "stem": "Mariah ( ) about the negative effects of alcohol every time she went out with her coworkers. After a while, they just stopped inviting her so that they could drink in peace.",
        "choices": ["ranted", "strutted", "poached", "shuffled"],
        "answerIndex": 0,
        "translation": "マライアは同僚と出かけるたびに、アルコールの悪影響についてわめいた。しばらくすると、同僚たちは安心して飲めるよう、彼女を誘わなくなった。",
    },
    {
        "stem": "Board members have been in a ( ) over this issue for over three months. If they don't come to an agreement soon, it could seriously upset the company's financial situation.",
        "choices": ["constellation", "paucity", "deadlock", "headway"],
        "answerIndex": 2,
        "translation": "取締役会のメンバーはこの問題で3か月以上行き詰まっている。すぐに合意できなければ、会社の財務状況に深刻な影響が出る可能性がある。",
    },
    {
        "stem": "When someone is choking, you must act quickly to ( ) the food stuck in their throat. There are a number of emergency procedures that can help clear a person's airways.",
        "choices": ["insinuate", "decant", "deprecate", "dislodge"],
        "answerIndex": 3,
        "translation": "誰かが窒息しているときは、喉に詰まった食べ物をすぐに取り除くため、素早く行動しなければならない。気道を確保するのに役立つ緊急処置はいくつかある。",
    },
    {
        "stem": "Darren's ( ) as a newspaper writer only lasted one year, but he has a lot of interesting stories from that time of his life.",
        "choices": ["layover", "vigil", "convalescence", "stint"],
        "answerIndex": 3,
        "translation": "ダレンの新聞記者としての仕事は1年しか続かなかったが、その時期の人生には興味深い話がたくさんある。",
    },
    {
        "stem": "The war marked a ( ) time in the nation's history. People were hungry and fighting amongst themselves, the economy was in ruins, and it seemed that there would be no end to the fighting.",
        "choices": ["vigilant", "consensual", "turbulent", "terse"],
        "answerIndex": 2,
        "translation": "その戦争は、国家の歴史における激動の時代を印象づけた。人々は飢え、互いに争い、経済は破綻し、戦闘が終わる気配はなかった。",
    },
    {
        "stem": "Experts suggest that some countries are likely to consider the peace treaty disadvantageous to their political goals, which could prevent its ( ).",
        "choices": ["attrition", "apparition", "revelation", "ratification"],
        "answerIndex": 3,
        "translation": "専門家は、一部の国がその平和条約を政治目標に不利だと考える可能性が高く、それによって批准が妨げられるかもしれないと指摘している。",
    },
    {
        "stem": "Chuck had to sell his restaurant when the government ( ) the land that it sat on in order to establish a nature preserve.",
        "choices": ["expropriated", "modulated", "piqued", "enumerated"],
        "answerIndex": 0,
        "translation": "チャックは、政府が自然保護区を設けるためにレストランの敷地を収用したとき、店を売らなければならなかった。",
    },
    {
        "stem": "The professor warned his students not to copy information from the Internet in their papers. \"Anyone caught committing ( ) will fail this class,\" he said.",
        "choices": ["divulgence", "blasphemy", "plagiarism", "walkout"],
        "answerIndex": 2,
        "translation": "教授は学生たちに、レポートでインターネット上の情報をコピーしないよう警告した。「剽窃をしているところを見つかった者は、この授業に落ちる」と彼は言った。",
    },
    {
        "stem": "As a child, Chris had to take speech classes because he often ( ), making it difficult for teachers to understand what he was saying.",
        "choices": ["acceded", "stammered", "whined", "resonated"],
        "answerIndex": 1,
        "translation": "子どものころ、クリスはよくどもって教師が発言を理解しにくかったため、発声の授業を受けなければならなかった。",
    },
    {
        "stem": "Martin seems to have an ( ) memory. He even remembers the name of every classmate he had in elementary school.",
        "choices": ["unwieldy", "ailing", "excruciating", "infallible"],
        "answerIndex": 3,
        "translation": "マーティンは絶対に間違いのない記憶力を持っているようだ。小学校時代の同級生全員の名前まで覚えている。",
    },
    {
        "stem": "Susan has a ( ) of complaints about her previous employer, including poor wages, long hours, and incompetent management.",
        "choices": ["pageant", "spasm", "morass", "litany"],
        "answerIndex": 3,
        "translation": "スーザンは、低賃金、長時間労働、無能な経営など、以前の雇用主について数多くの不満を並べ立てている。",
    },
    {
        "stem": 'In his speech the CEO said, "Intelligence is useful, but hard work and persistence are the only true ( ) for success in this world."',
        "choices": ["pretexts", "ledgers", "requisites", "facades"],
        "answerIndex": 2,
        "translation": "CEOはスピーチで、「知性は役に立つが、この世界で成功するための真の必須条件は勤勉さと粘り強さだけだ」と述べた。",
    },
    {
        "stem": "The students in Dick's language class were still at a low level, so he had to ( ) his words very clearly in order for them to understand what he was saying.",
        "choices": ["foist", "muffle", "enunciate", "ascribe"],
        "answerIndex": 2,
        "translation": "ディックの語学クラスの生徒たちはまだ初級レベルだったので、彼は生徒たちが理解できるよう、言葉をとても明瞭に発音しなければならなかった。",
    },
    {
        "stem": "After winning a record number of medals at the Olympics, the swimmer ( ) his sudden fame by appearing in television commercials and magazine ads.",
        "choices": ["crept up on", "chipped away at", "cashed in on", "put in for"],
        "answerIndex": 2,
        "translation": "オリンピックで記録的な数のメダルを獲得した後、その水泳選手はテレビCMや雑誌広告に出演して突然の名声を利用した。",
    },
    {
        "stem": "A: Bill's not here because he ( ) at the last minute.\nB: Again? He always promises to go out with us, then he backs out right before we meet up!",
        "choices": ["brimmed over", "copped out", "leveled off", "played off"],
        "answerIndex": 1,
        "translation": "A：ビルがここにいないのは、直前になって約束をすっぽかしたからだよ。\nB：また？彼はいつも一緒に出かけると約束するのに、会う直前になって断るんだ！",
    },
    {
        "stem": "A: Why is the website loading so slowly today?\nB: The unusually high number of visitors is ( ) the servers. If we continue to get this level of traffic, we may need to upgrade them.",
        "choices": ["bogging down", "phasing out", "staking out", "hemming in"],
        "answerIndex": 0,
        "translation": "A：今日はなぜウェブサイトの読み込みがこんなに遅いの？\nB：異常に多い訪問者数がサーバーの動作を遅くしているんだ。この水準のアクセスが続くなら、サーバーをアップグレードする必要があるかもしれない。",
    },
    {
        "stem": "A: It's still raining. What should we do? We don't have umbrellas.\nB: Let's just wait here for a little while longer. I think it's starting to ( ).",
        "choices": ["taper off", "work out", "fan out", "blare out"],
        "answerIndex": 0,
        "translation": "A：まだ雨が降っている。どうしよう？傘を持っていないよ。\nB：もう少しここで待とう。雨が弱まり始めていると思う。",
    },
]


DETAILS = {
    "dispatched": ("派遣した、発送した", "動詞", "The agency dispatched a team to inspect the damaged bridge.", "その機関は損傷した橋を調査するためチームを派遣した。"),
    "trampled": ("踏みつけた、踏みにじった", "動詞", "The crowd trampled the flowers while rushing toward the stage.", "観客はステージへ急ぐ途中で花を踏みつけた。"),
    "touted": ("称賛して売り込んだ", "動詞", "The company touted its new battery as a major technological breakthrough.", "その会社は新しい電池を大きな技術革新として売り込んだ。"),
    "toppled": ("倒した、倒れた", "動詞", "The strong wind toppled several trees along the road.", "強風で道路沿いの木が何本も倒れた。"),
    "bluntly": ("率直に、ぶっきらぼうに", "副詞", "She bluntly told the committee that the plan would fail.", "彼女はその計画は失敗すると委員会に率直に告げた。"),
    "innately": ("生まれつき、本質的に", "副詞", "Some people are innately good at recognizing musical patterns.", "音楽のパターンを見分けるのが生まれつき得意な人もいる。"),
    "astutely": ("鋭く、抜け目なく", "副詞", "The analyst astutely identified the hidden risk in the proposal.", "その分析官は提案に隠れたリスクを鋭く見抜いた。"),
    "devoutly": ("敬虔に、心から", "副詞", "The family devoutly observed the traditions of their community.", "その家族は地域の伝統を敬虔に守った。"),
    "streaking": ("疾走すること、素早く走ること", "動詞", "A deer was streaking across the empty field at dawn.", "夜明けに鹿が誰もいない野原を疾走していた。"),
    "canvassing": ("戸別訪問による勧誘、調査", "動詞", "The volunteers spent the weekend canvassing for votes.", "ボランティアたちは週末を投票の戸別勧誘に費やした。"),
    "impelling": ("駆り立てる", "動詞", "A desire to help others was impelling her to study medicine.", "人を助けたいという思いが彼女を医学の勉強へ駆り立てていた。"),
    "honing": ("磨く、鍛える", "動詞", "He is honing his presentation skills before the conference.", "彼は会議を前にプレゼンテーション能力を磨いている。"),
    "rigorous": ("厳格な、厳密な", "形容詞", "The laboratory follows rigorous safety procedures.", "その研究所は厳格な安全手順に従っている。"),
    "perplexed": ("困惑した", "形容詞", "The unexpected result left the researchers perplexed.", "予想外の結果に研究者たちは困惑した。"),
    "insurgent": ("反乱者、反政府の", "名詞・形容詞", "The army negotiated with insurgent groups for a temporary cease-fire.", "軍は一時停戦のため反政府勢力と交渉した。"),
    "sedate": ("静かな、落ち着いた", "形容詞", "The hotel has a sedate atmosphere that suits business travelers.", "そのホテルにはビジネス客に合う落ち着いた雰囲気がある。"),
    "palliative": ("緩和的な、苦痛を和らげる", "形容詞", "The treatment was palliative rather than a cure for the disease.", "その治療は病気を治すものではなく、苦痛を和らげるものだった。"),
    "sinister": ("不吉な、邪悪な", "形容詞", "The abandoned house had a sinister appearance after sunset.", "その廃屋は日没後、不吉な外観を見せた。"),
    "colloquial": ("口語の、話し言葉の", "形容詞", "The textbook explains several colloquial expressions used by teenagers.", "その教科書は若者が使う口語表現をいくつか説明している。"),
    "destitute": ("貧困に陥った、無一文の", "形容詞", "The charity provides meals for destitute families.", "その慈善団体は困窮した家庭に食事を提供している。"),
    "arcane": ("難解な、一般には知られていない", "形容詞", "Only a few specialists understand the arcane rules of the old game.", "その古いゲームの難解な規則を理解している専門家はほとんどいない。"),
    "inclement": ("荒天の、厳しい", "形容詞", "The flight was canceled because of inclement weather.", "悪天候のため、その便は欠航になった。"),
    "benevolent": ("慈悲深い、善意の", "形容詞", "A benevolent donor paid for the children's medical treatment.", "慈悲深い寄付者が子どもたちの治療費を支払った。"),
    "covetous": ("欲深い、むやみに欲しがる", "形容詞", "The covetous heir wanted every valuable object in the estate.", "欲深い相続人は遺産にある高価な物をすべて欲しがった。"),
    "dissuade": ("思いとどまらせる", "動詞", "Her friends tried to dissuade her from driving in the storm.", "友人たちは嵐の中で運転するのを思いとどまらせようとした。"),
    "straddle": ("またぐ、両立させる", "動詞", "The new policy tries to straddle environmental and economic priorities.", "新しい政策は環境上の優先事項と経済上の優先事項を両立させようとしている。"),
    "contravene": ("違反する、反する", "動詞", "The proposal would contravene the country's privacy laws.", "その提案は国のプライバシー法に違反するだろう。"),
    "infiltrate": ("潜入する、浸透する", "動詞", "The journalist managed to infiltrate the secretive organization.", "その記者は秘密主義の組織に何とか潜入した。"),
    "perforation": ("穴あけ、穿孔", "名詞", "The doctor found a small perforation in the patient's eardrum.", "医師は患者の鼓膜に小さな穿孔を見つけた。"),
    "culmination": ("最高潮、集大成", "名詞", "The concert was the culmination of months of rehearsals.", "そのコンサートは何か月ものリハーサルの集大成だった。"),
    "adulation": ("過度な称賛", "名詞", "The actor became uncomfortable with the constant adulation from fans.", "その俳優はファンから絶えず過剰な称賛を受けることに居心地の悪さを感じた。"),
    "abomination": ("忌まわしいもの、嫌悪すべきもの", "名詞", "The environmental group called the illegal dump an abomination.", "環境団体はその不法投棄場を忌まわしいものだと呼んだ。"),
    "ranted": ("わめいた、激しく不平を言った", "動詞", "He ranted about the unfair rule for nearly an hour.", "彼はその不公平な規則について1時間近くわめいた。"),
    "strutted": ("気取って歩いた", "動詞", "The peacock strutted proudly across the garden.", "そのクジャクは庭を誇らしげに歩いた。"),
    "poached": ("密猟した、引き抜いた", "動詞", "The rangers arrested hunters who had poached rare animals.", "レンジャーは希少動物を密猟した猟師たちを逮捕した。"),
    "shuffled": ("混ぜた、とぼとぼ歩いた", "動詞", "The tired passengers shuffled slowly toward the exit.", "疲れた乗客たちは出口へゆっくりとぼとぼ歩いた。"),
    "constellation": ("星座、一群", "名詞", "A constellation of small firms now supports the local industry.", "現在では小企業の一群が地域産業を支えている。"),
    "paucity": ("不足、少数", "名詞", "The paucity of reliable data made the decision difficult.", "信頼できるデータの不足が判断を難しくした。"),
    "deadlock": ("行き詰まり、膠着状態", "名詞", "The negotiations reached a deadlock over the final price.", "交渉は最終価格をめぐって行き詰まった。"),
    "headway": ("進展、前進", "名詞", "The research team is finally making headway on the vaccine.", "研究チームはようやくワクチン開発を進展させている。"),
    "insinuate": ("ほのめかす、巧みに入り込ませる", "動詞", "He tried to insinuate that the manager had made a mistake.", "彼は管理職が間違いを犯したとほのめかそうとした。"),
    "decant": ("液体を別容器へ移す", "動詞", "Please decant the wine carefully so the sediment stays in the bottle.", "沈殿物が瓶に残るよう、ワインを注意深く別容器へ移してください。"),
    "deprecate": ("非難する、価値を低く見る", "動詞", "The director deprecated the use of fear in advertising.", "その監督は広告で恐怖を使うことを非難した。"),
    "dislodge": ("取り除く、追い出す", "動詞", "The dentist used a tool to dislodge the piece of food.", "歯科医は器具を使って食べ物のかけらを取り除いた。"),
    "layover": ("乗り継ぎ待ち", "名詞", "We had a five-hour layover in Singapore.", "私たちはシンガポールで5時間の乗り継ぎ待ちをした。"),
    "vigil": ("夜通しの見守り、徹夜の祈り", "名詞", "The family held a vigil beside the patient's bed.", "家族は患者のベッドのそばで夜通し見守った。"),
    "convalescence": ("回復期", "名詞", "She spent several weeks in convalescence after the operation.", "彼女は手術後、数週間を回復期として過ごした。"),
    "stint": ("一定期間の仕事、任期", "名詞", "His stint as a teacher changed the way he viewed education.", "教師としての一定期間の仕事が、彼の教育観を変えた。"),
    "vigilant": ("警戒を怠らない", "形容詞", "Security guards must remain vigilant throughout the night.", "警備員は一晩中警戒を怠ってはならない。"),
    "consensual": ("合意に基づく", "形容詞", "The two companies reached a consensual agreement after weeks of talks.", "2社は数週間の協議の後、合意に基づく契約を結んだ。"),
    "turbulent": ("激動の、荒れた", "形容詞", "The country experienced a turbulent decade after the revolution.", "その国は革命後、激動の10年間を経験した。"),
    "terse": ("簡潔な、そっけない", "形容詞", "The manager gave a terse reply and left the room.", "管理職はそっけない返事をして部屋を出た。"),
    "attrition": ("消耗、漸減", "名詞", "The army suffered heavy losses through attrition during the long war.", "その軍は長期戦の消耗によって大きな損失を被った。"),
    "apparition": ("幽霊、突然現れたもの", "名詞", "A pale apparition appeared at the edge of the forest.", "森の端に青白い幽霊が現れた。"),
    "revelation": ("啓示、暴露", "名詞", "The revelation of the hidden costs shocked the customers.", "隠れた費用の暴露に顧客たちは驚いた。"),
    "ratification": ("批准、承認", "名詞", "The treaty will take effect after ratification by both parliaments.", "その条約は両国の議会による批准後に発効する。"),
    "expropriated": ("収用した", "動詞", "The government expropriated the property to build a public hospital.", "政府は公立病院を建設するためその土地を収用した。"),
    "modulated": ("調整した、変調した", "動詞", "The engineer modulated the signal to reduce interference.", "技術者は干渉を減らすため信号を調整した。"),
    "piqued": ("興味をそそった、立腹させた", "動詞", "The unusual title piqued my curiosity about the book.", "珍しい題名がその本への私の好奇心をそそった。"),
    "enumerated": ("列挙した", "動詞", "The report enumerated the steps needed to improve safety.", "その報告書は安全性を高めるために必要な手順を列挙した。"),
    "divulgence": ("漏洩、暴露", "名詞", "The divulgence of confidential data caused a serious scandal.", "機密データの漏洩が深刻な問題を引き起こした。"),
    "blasphemy": ("冒涜", "名詞", "The critic was accused of blasphemy after insulting the sacred symbol.", "その評論家は神聖な象徴を侮辱した後、冒涜の罪を問われた。"),
    "plagiarism": ("盗用、剽窃", "名詞", "The student received a failing grade for plagiarism.", "その学生は剽窃のため不合格の評価を受けた。"),
    "walkout": ("ストライキ、集団退場", "名詞", "The workers organized a walkout to protest unsafe conditions.", "労働者たちは危険な環境に抗議するためストライキを組織した。"),
    "acceded": ("同意した、就任した", "動詞", "The board acceded to the employees' request for flexible hours.", "取締役会は従業員の柔軟な勤務時間の要望に同意した。"),
    "stammered": ("どもった", "動詞", "The nervous witness stammered when asked about the missing money.", "緊張した証人は、なくなった金について尋ねられるとどもった。"),
    "whined": ("泣き言を言った、鼻にかかった声で鳴いた", "動詞", "The child whined about having to leave the playground.", "その子は遊び場を出なければならないことについて泣き言を言った。"),
    "resonated": ("共鳴した、響いた", "動詞", "Her message resonated with young voters across the country.", "彼女のメッセージは全国の若い有権者の心に響いた。"),
    "unwieldy": ("扱いにくい、大きくて不便な", "形容詞", "The old machine is too unwieldy to move without special equipment.", "その古い機械は大きくて扱いにくく、特別な装置なしでは動かせない。"),
    "ailing": ("病気の、不調な", "形容詞", "The government introduced a plan to support the ailing industry.", "政府は不調な産業を支援する計画を導入した。"),
    "excruciating": ("激痛の、非常に苦しい", "形容詞", "He felt excruciating pain in his injured knee.", "彼はけがをした膝に激痛を感じた。"),
    "infallible": ("絶対に間違いのない", "形容詞", "No memory is completely infallible, even in a careful witness.", "注意深い証人であっても、記憶が完全に間違いないとは限らない。"),
    "pageant": ("野外劇、美人コンテスト", "名詞", "The town holds a historical pageant every autumn.", "その町では毎年秋に歴史野外劇を開催する。"),
    "spasm": ("けいれん、発作", "名詞", "A sudden spasm in his back forced him to stop working.", "背中の突然のけいれんで、彼は仕事をやめざるを得なかった。"),
    "morass": ("泥沼、複雑で困難な状況", "名詞", "The project became a morass of conflicting regulations.", "その計画は相反する規則が絡み合う泥沼になった。"),
    "litany": ("長い列挙、連祷", "名詞", "The report included a litany of problems with the old system.", "その報告書には旧システムの問題が長々と列挙されていた。"),
    "pretexts": ("口実", "名詞", "They invented several pretexts for canceling the meeting.", "彼らは会議を中止するためにいくつかの口実を作った。"),
    "ledgers": ("元帳、会計簿", "名詞", "The accountant checked the ledgers for signs of fraud.", "会計士は不正の兆候がないか元帳を調べた。"),
    "requisites": ("必要条件、必須品", "名詞", "A valid passport and visa are requisites for the journey.", "有効なパスポートとビザはその旅行の必要条件だ。"),
    "facades": ("外見、建物の正面", "名詞", "Behind the elegant facades, many buildings needed major repairs.", "優雅な外観の裏で、多くの建物は大規模な修理を必要としていた。"),
    "foist": ("押しつける、だます", "動詞", "The seller tried to foist an outdated computer on an inexperienced buyer.", "その販売員は古いコンピューターを経験の浅い買い手に押しつけようとした。"),
    "muffle": ("音を消す、包んで覆う", "動詞", "Thick curtains muffled the noise from the busy street.", "厚いカーテンが大通りの騒音を和らげた。"),
    "enunciate": ("明瞭に発音する", "動詞", "Please enunciate each word so the recording is clear.", "録音が明瞭になるよう、一語一語をはっきり発音してください。"),
    "ascribe": ("帰する、原因を〜に求める", "動詞", "Scientists ascribe the decline in fish to warmer ocean temperatures.", "科学者たちは魚の減少の原因を海水温の上昇に求めている。"),
    "crept up on": ("徐々に近づいた、不意に襲った", "熟語", "The deadline crept up on us before we had finished the design.", "設計を終える前に締め切りがいつの間にか迫ってきた。"),
    "chipped away at": ("少しずつ削った、地道に取り組んだ", "熟語", "She chipped away at the mountain of paperwork every evening.", "彼女は毎晩、山積みの書類に少しずつ取り組んだ。"),
    "cashed in on": ("〜を利用して利益を得た", "熟語", "Several companies cashed in on the sudden popularity of the sport.", "いくつかの会社がそのスポーツの突然の人気を利用して利益を得た。"),
    "put in for": ("〜を申請した、応募した", "熟語", "He put in for a transfer to the company office overseas.", "彼は海外の会社支社への異動を申請した。"),
    "brimmed over": ("あふれた、満ちあふれた", "熟語", "The cup brimmed over when the waiter kept pouring coffee.", "店員がコーヒーを注ぎ続けたので、カップからコーヒーがあふれた。"),
    "copped out": ("逃げた、責任を回避した", "熟語", "He copped out of the difficult task and left it to his teammate.", "彼は難しい仕事から逃げて、チームメートに任せた。"),
    "leveled off": ("横ばいになった、安定した", "熟語", "After rising quickly, housing prices leveled off.", "急上昇した後、住宅価格は横ばいになった。"),
    "played off": ("対立させた、うまく利用した", "熟語", "The negotiator played the two suppliers off against each other.", "交渉担当者は2社の供給業者を互いに競わせた。"),
    "bogging down": ("動きを遅くする、停滞させる", "熟語", "Too many approval steps are bogging down the construction project.", "承認手続きが多すぎて建設計画の進行が遅れている。"),
    "phasing out": ("段階的に廃止する", "熟語", "The company is phasing out its least efficient products.", "その会社は最も効率の悪い製品を段階的に廃止している。"),
    "staking out": ("見張る、場所を確保する", "熟語", "The reporters were staking out the politician's office.", "記者たちは政治家の事務所を張り込んでいた。"),
    "hemming in": ("取り囲む、行動を制限する", "熟語", "High walls were hemming in the small courtyard.", "高い壁が小さな中庭を取り囲んでいた。"),
    "taper off": ("次第に弱まる、減少する", "熟語", "The rain began to taper off before sunset.", "日没前に雨が次第に弱まり始めた。"),
    "work out": ("解決する、うまくいく", "熟語", "We need to work out a fair schedule for the whole team.", "チーム全体のために公平な予定を決める必要がある。"),
    "fan out": ("扇状に広がる、散開する", "熟語", "The searchers fanned out across the valley.", "捜索隊は谷全体に散開した。"),
    "blare out": ("大音量で鳴り響く", "熟語", "The alarm blared out across the quiet building.", "警報が静かな建物全体に大音量で鳴り響いた。"),
}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build() -> tuple[dict, dict]:
    if len(QUESTIONS) != 25:
        raise ValueError("模試 第2回は25問である必要があります")
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
        "source": "ユーザー提供の模試原稿（模試 第2回）を学習用JSONへ構造化",
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
    write_json(DATA_DIR / "vocab_1_mock-2.json", vocab)
    write_json(DATA_DIR / "questions_1_mock-2.json", questions)
    print("mock-2: 25 questions / 100 items (84 words, 16 idioms)")


if __name__ == "__main__":
    main()
