"""ユーザー提供の英検1級「模試 第3回」をQ1形式へ変換する。"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ROUND_ID = "mock-3"


QUESTIONS = [
    {
        "stem": "A: Mrs. Jones told Emilio that she was going to fire him if he came in late again.\nB: She's just ( ). She can't afford to fire Emilio. He's our best salesman.",
        "choices": ["degenerating", "haggling", "scowling", "bluffing"],
        "answerIndex": 3,
        "translation": "A：ジョーンズ夫人は、また遅刻したらエミリオを解雇すると言った。\nB：彼女はただはったりをかけているだけだ。エミリオを解雇する余裕はない。彼は私たちの最高の営業マンだから。",
    },
    {
        "stem": "Bart's mom called for him to come downstairs for dinner, but he was so focused on his video game that he remained completely ( ).",
        "choices": ["devious", "magnanimous", "deciduous", "oblivious"],
        "answerIndex": 3,
        "translation": "バートの母親は夕食のため階下に来るよう彼を呼んだが、彼はテレビゲームに集中していて、まったく気づかないままだった。",
    },
    {
        "stem": "George and Mariah hit a few ( ) in the last week of their trip, which caused them to miss a couple of the sights they'd wanted to see.",
        "choices": ["regimes", "glimmers", "liaisons", "glitches"],
        "answerIndex": 3,
        "translation": "ジョージとマライアは旅行の最後の週にいくつかの問題にぶつかり、見たかった名所を何か所か見逃した。",
    },
    {
        "stem": "Gregory Craftsman ( ) the revolution, so many thought that he was the best person to lead the newly established government.",
        "choices": ["debarred", "spearheaded", "beckoned", "reciprocated"],
        "answerIndex": 1,
        "translation": "グレゴリー・クラフツマンは革命を主導したので、多くの人が彼こそ新しく成立した政府を率いる最適な人物だと考えた。",
    },
    {
        "stem": "Researchers say that taking their newly developed medicine at the ( ) of the flu decreases its duration by three days, on average.",
        "choices": ["pivot", "onset", "gradient", "jab"],
        "answerIndex": 1,
        "translation": "研究者によると、新しく開発された薬をインフルエンザの発症時に飲むと、平均で罹患期間が3日短くなる。",
    },
    {
        "stem": "With many differing positions on how to deal with the threat of a military conflict, the political party split into a variety of ( ), making it difficult for them to make big decisions effectively.",
        "choices": ["stakes", "sanctuaries", "shrugs", "factions"],
        "answerIndex": 3,
        "translation": "軍事衝突の脅威への対応をめぐって多くの異なる立場があったため、その政党はさまざまな派閥に分裂し、大きな決定を効果的に下すことが難しくなった。",
    },
    {
        "stem": "According to reports, the other passengers on the bus just sat ( ) by as the old woman had her purse stolen. \"No one did anything to help her,\" one witness said.",
        "choices": ["somberly", "idly", "flagrantly", "inherently"],
        "answerIndex": 1,
        "translation": "報道によると、老婦人が財布を盗まれている間、バスの他の乗客はただ何もせず傍観していた。「誰も彼女を助けるために何もしなかった」と目撃者の一人は述べた。",
    },
    {
        "stem": "The famous actress did not have any family when she died, and she ( ) her entire fortune to a children's charity in her hometown.",
        "choices": ["sanctified", "convened", "detracted", "bequeathed"],
        "answerIndex": 3,
        "translation": "その有名な女優には亡くなった時に家族がいなかったため、全財産を故郷の子ども向け慈善団体に遺贈した。",
    },
    {
        "stem": "In the event of a fire, please stay low to the ground in order to avoid ( ) the smoke, as it can cause you to lose consciousness.",
        "choices": ["slanting", "inhaling", "deflecting", "whetting"],
        "answerIndex": 1,
        "translation": "火事の際は、煙を吸い込むと意識を失うことがあるので、煙を吸わないよう地面近くの低い姿勢を保ってください。",
    },
    {
        "stem": "A: How's that new job of yours?\nB: The pay isn't too bad, but it's such ( ) work. I think that I might have the most boring job in the world.",
        "choices": ["sumptuous", "transient", "mundane", "pessimistic"],
        "answerIndex": 2,
        "translation": "A：新しい仕事はどう？\nB：給料はそれほど悪くないけれど、あまりに退屈な仕事なんだ。世界で一番つまらない仕事かもしれないと思うよ。",
    },
    {
        "stem": "Chelsea became ( ) when she couldn't find her daughter at the department store. She started crying and calling out for help. Luckily, her daughter was just hiding inside of a clothing rack.",
        "choices": ["lenient", "frantic", "ascetic", "livid"],
        "answerIndex": 1,
        "translation": "チェルシーはデパートで娘を見つけられず、取り乱した。泣きながら助けを求めて叫び始めた。幸い、娘は洋服ラックの中に隠れていただけだった。",
    },
    {
        "stem": "Martin tried dieting again and again, but he always ( ) to his temptation to eat fatty foods. \"I just don't have enough self-control,\" he said.",
        "choices": ["fared", "compounded", "succumbed", "corroded"],
        "answerIndex": 2,
        "translation": "マーティンは何度もダイエットを試みたが、脂っこい食べ物を食べたいという誘惑にいつも屈した。「自制心が足りないだけだ」と彼は言った。",
    },
    {
        "stem": "Many people complained that the government's newly proposed identification system, which includes fingerprinting every citizen, would be ( ) upon people's privacy.",
        "choices": ["disembarking", "acquiescing", "delving", "infringing"],
        "answerIndex": 3,
        "translation": "すべての市民の指紋を採取する政府の新しい身分証明制度は、人々のプライバシーを侵害するものだと多くの人が不満を述べた。",
    },
    {
        "stem": "A: I'm feeling much better now, Coach Wallace. Can't I just go home?\nB: I'm sorry, Billy, but anytime a player loses consciousness, ( ) states that I must take them to the nearest hospital.",
        "choices": ["coronation", "vogue", "maneuver", "protocol"],
        "answerIndex": 3,
        "translation": "A：ウォレスコーチ、もうずっと気分がよくなりました。帰ってはいけませんか？\nB：すまない、ビリー。しかし選手が意識を失った場合はいつでも、規定により最寄りの病院へ連れて行かなければならないんだ。",
    },
    {
        "stem": "Dennis covered the walls of his office with a special type of foam to ( ) it from outside sounds because he often had to make audio recordings for his work.",
        "choices": ["abort", "reclaim", "pinpoint", "insulate"],
        "answerIndex": 3,
        "translation": "デニスは仕事で音声録音をすることが多かったので、外の音を遮断するため、特殊な泡状素材でオフィスの壁を覆った。",
    },
    {
        "stem": "The manager praised Kenta for his ( ) work, saying that his performance served as a good model for all of the other employees to follow.",
        "choices": ["exemplary", "haggard", "insipid", "petulant"],
        "answerIndex": 0,
        "translation": "マネージャーはケンタの模範的な仕事ぶりを称賛し、彼の働きは他の従業員全員が見習うべきよい手本だと述べた。",
    },
    {
        "stem": "A: Charlie had the ( ) to ask Mr. Withers for another day off next week.\nB: Again!? I can't believe it. He knows how busy everyone is this month.",
        "choices": ["envoy", "allegory", "gall", "intrigue"],
        "answerIndex": 2,
        "translation": "A：チャーリーは、来週もう1日休みを取れないかウィザーズさんに頼む厚かましさがあった。\nB：また？信じられない。今月みんながどれだけ忙しいか分かっているのに。",
    },
    {
        "stem": "The international community warned the nation's leaders that there would be heavy economic ( ) for failure to withdraw from the military conflict.",
        "choices": ["reprisals", "provisos", "apexes", "fringes"],
        "answerIndex": 0,
        "translation": "国際社会はその国の指導者たちに、軍事衝突から撤退しなければ重い経済的報復を受けることになると警告した。",
    },
    {
        "stem": "A cruise company has begun organizing trips to the ( ), including a two-week option where guests can visit all of its 22 islands.",
        "choices": ["onslaught", "archipelago", "aberration", "sham"],
        "answerIndex": 1,
        "translation": "あるクルーズ会社が、その群島への旅行の企画を始めた。2週間かけて22の島すべてを訪れる選択肢もある。",
    },
    {
        "stem": "Brenda had been ( ) the question the teacher had asked the class for over a week, but she still could not think of an answer.",
        "choices": ["devouring", "cradling", "pondering", "juxtaposing"],
        "answerIndex": 2,
        "translation": "ブレンダは先生がクラスに出した問題を1週間以上考え続けていたが、それでも答えを思いつけなかった。",
    },
    {
        "stem": "The judge found Graham criminally ( ) for playing a game on his smartphone when he caused the car crash. \"Your carelessness could have killed someone,\" the judge said.",
        "choices": ["negligent", "pedantic", "dainty", "introspective"],
        "answerIndex": 0,
        "translation": "グラハムが自動車事故を起こした際にスマートフォンでゲームをしていたため、裁判官は彼に刑事上の過失があると認定した。「あなたの不注意で誰かが死んでいたかもしれない」と裁判官は述べた。",
    },
    {
        "stem": "The company decided to ( ) the marketing work for their new product because it would be more time-efficient than trying to do it themselves.",
        "choices": ["dabble in", "let down", "put across", "farm out"],
        "answerIndex": 3,
        "translation": "その会社は、新製品のマーケティング業務を自社で行おうとするより時間効率がよいとして、外注することに決めた。",
    },
    {
        "stem": "Rebecca was just wandering around the local flea market when she ( ) a signed copy of her favorite novel. It was a bit expensive, but she bought it anyway.",
        "choices": ["stumbled upon", "chipped off", "marked out", "fawned over"],
        "answerIndex": 0,
        "translation": "レベッカが地元のフリーマーケットをぶらぶらしていると、好きな小説の署名入り本を偶然見つけた。少し高かったが、それでも買った。",
    },
    {
        "stem": "The night before her trip to Madagascar, Christie was so ( ) that she couldn't sleep at all. She couldn't wait for her trip to begin.",
        "choices": ["laid on", "keyed up", "banked on", "held down"],
        "answerIndex": 1,
        "translation": "マダガスカル旅行の前夜、クリスティーはとても興奮していてまったく眠れなかった。旅行が始まるのが待ちきれなかったのだ。",
    },
    {
        "stem": "Carlyle thought that he had no chance of winning the election for class president, but in the end he just ( ). He won by a single vote.",
        "choices": ["backed out", "flipped out", "squeaked by", "sank in"],
        "answerIndex": 2,
        "translation": "カーライルはクラス委員長選挙に勝つ見込みがないと思っていたが、最後にはかろうじて勝った。1票差での勝利だった。",
    },
]


DETAILS = {
    "degenerating": ("悪化している、退化している", "動詞", "The patient's condition is degenerating despite the treatment.", "その患者の状態は治療にもかかわらず悪化している。"),
    "haggling": ("値段を交渉すること", "動詞", "He spent an hour haggling over the price of the rug.", "彼はそのじゅうたんの値段を1時間かけて値切り交渉した。"),
    "scowling": ("しかめ面をしている", "動詞", "The manager stood scowling at the careless workers.", "部長は不注意な作業員たちをにらみつけながら立っていた。"),
    "bluffing": ("はったりをかけること", "動詞", "I knew he was bluffing when he threatened to quit.", "彼が辞めると脅したとき、私はそれがはったりだと分かった。"),
    "devious": ("ずる賢い、狡猾な", "形容詞", "The devious salesman hid the contract's most important clause.", "そのずる賢い販売員は契約書の最も重要な条項を隠した。"),
    "magnanimous": ("寛大な、度量の大きい", "形容詞", "The magnanimous winner congratulated the athlete who had lost.", "その度量の大きい勝者は、敗れた選手を祝福した。"),
    "deciduous": ("落葉性の", "形容詞", "Maple trees are deciduous and lose their leaves in autumn.", "カエデは落葉樹で、秋に葉を落とす。"),
    "oblivious": ("気づかない、無頓着な", "形容詞", "He was oblivious to the warning signs around him.", "彼は周囲の警告サインに気づいていなかった。"),
    "regimes": ("政権、体制", "名詞", "Several regimes have changed since the country gained independence.", "その国が独立して以来、いくつもの政権が変わった。"),
    "glimmers": ("かすかな光、兆し", "名詞", "There were glimmers of hope after the negotiations resumed.", "交渉が再開された後、かすかな希望の兆しが見えた。"),
    "liaisons": ("連絡、協力関係", "名詞", "The school maintains liaisons with local businesses.", "その学校は地元企業と連絡・協力関係を保っている。"),
    "glitches": ("小さな不具合、障害", "名詞", "The new software still has a few glitches.", "新しいソフトウェアにはまだいくつかの小さな不具合がある。"),
    "debarred": ("締め出した、資格を奪った", "動詞", "The athlete was debarred from the competition for cheating.", "その選手は不正行為のため大会への参加資格を奪われた。"),
    "spearheaded": ("主導した", "動詞", "Dr. Lee spearheaded the campaign to clean the river.", "リー博士は川をきれいにする運動を主導した。"),
    "beckoned": ("手招きした、呼び寄せた", "動詞", "The waiter beckoned us toward an empty table.", "ウェイターは空いているテーブルへ私たちを手招きした。"),
    "reciprocated": ("返礼した、応じた", "動詞", "She smiled at him, and he reciprocated with a wave.", "彼女が彼に微笑むと、彼は手を振って応じた。"),
    "pivot": ("転換点、中心軸", "名詞", "The discovery became a pivot in the history of medicine.", "その発見は医学史の転換点となった。"),
    "onset": ("始まり、発症", "名詞", "The medicine should be taken at the onset of symptoms.", "その薬は症状が出始めた時に服用すべきだ。"),
    "gradient": ("勾配、傾斜", "名詞", "The road has a steep gradient near the mountain pass.", "その道路は山道の近くで急な勾配になっている。"),
    "jab": ("突き、注射", "名詞", "The nurse gave me a jab before the trip.", "看護師は旅行前に私に予防接種をした。"),
    "stakes": ("賭け金、利害", "名詞", "The stakes are high in this election.", "今回の選挙は利害が大きくかかっている。"),
    "sanctuaries": ("聖域、保護区", "名詞", "The islands provide sanctuaries for endangered birds.", "その島々は絶滅危惧種の鳥の保護区になっている。"),
    "shrugs": ("肩をすくめること", "名詞", "His repeated shrugs showed that he had no answer.", "彼が何度も肩をすくめたことは、答えがないことを示していた。"),
    "factions": ("派閥", "名詞", "Two factions within the party disagreed over the proposal.", "党内の二つの派閥がその提案をめぐって意見を異にした。"),
    "somberly": ("重苦しく、厳粛に", "副詞", "The mayor somberly announced the loss of the rescue team.", "市長は救助隊の犠牲を重苦しく発表した。"),
    "idly": ("何もせず、ぼんやりと", "副詞", "The passengers idly watched the rain through the windows.", "乗客たちは窓越しに雨をぼんやり眺めていた。"),
    "flagrantly": ("露骨に、甚だしく", "副詞", "The company flagrantly ignored the safety regulations.", "その会社は安全規則を露骨に無視した。"),
    "inherently": ("本質的に", "副詞", "The task is not inherently difficult.", "その仕事は本質的に難しいわけではない。"),
    "sanctified": ("神聖化した、清めた", "動詞", "The priest sanctified the new chapel.", "司祭は新しい礼拝堂を聖別した。"),
    "convened": ("招集した、集まった", "動詞", "The committee convened to discuss the emergency.", "委員会は緊急事態について話し合うため招集された。"),
    "detracted": ("損なった、減じた", "動詞", "The minor error detracted from an otherwise excellent report.", "その小さな誤りが、他は優れた報告書の価値を損なった。"),
    "bequeathed": ("遺贈した", "動詞", "She bequeathed her house to the local museum.", "彼女は自宅を地元の博物館に遺贈した。"),
    "slanting": ("斜めに傾ける、傾斜する", "動詞", "The slanting rain made it hard to see the road.", "斜めに降る雨のため、道路が見えにくかった。"),
    "inhaling": ("吸い込むこと", "動詞", "Inhaling smoke can damage the lungs.", "煙を吸い込むと肺を傷めることがある。"),
    "deflecting": ("そらす、かわす", "動詞", "The shield is designed for deflecting heat.", "その盾は熱をそらすために設計されている。"),
    "whetting": ("研ぐ、刺激する", "動詞", "The preview whetted the audience's appetite for the film.", "予告編は観客の映画への期待をかき立てた。"),
    "sumptuous": ("豪華な", "形容詞", "The hotel served a sumptuous dinner to its guests.", "そのホテルは宿泊客に豪華な夕食を出した。"),
    "transient": ("一時的な、つかの間の", "形容詞", "The shelter offers beds for transient workers.", "その施設は一時的な労働者にベッドを提供する。"),
    "mundane": ("ありふれた、退屈な", "形容詞", "She wanted a break from her mundane office routine.", "彼女はありふれた事務仕事の日課から離れたかった。"),
    "pessimistic": ("悲観的な", "形容詞", "His pessimistic forecast discouraged the investors.", "彼の悲観的な予測は投資家たちを落胆させた。"),
    "lenient": ("寛大な、厳しくない", "形容詞", "The judge was lenient because it was the student's first offense.", "裁判官は生徒の初犯だったので寛大だった。"),
    "frantic": ("取り乱した、必死の", "形容詞", "The frantic mother searched every room in the house.", "取り乱した母親は家中の部屋を探した。"),
    "ascetic": ("禁欲的な", "形容詞", "The ascetic monk owned almost nothing.", "その禁欲的な修道士はほとんど何も所有していなかった。"),
    "livid": ("激怒した、青ざめた", "形容詞", "She was livid when she discovered the missing files.", "彼女はなくなったファイルに気づいて激怒した。"),
    "fared": ("うまくいった、進んだ", "動詞", "How did you fare on the difficult examination?", "難しい試験の出来はどうでしたか。"),
    "compounded": ("悪化させた、複合した", "動詞", "The delay compounded the problems caused by the storm.", "遅れが嵐による問題をさらに悪化させた。"),
    "succumbed": ("屈した、負けた", "動詞", "He finally succumbed to pressure from his colleagues.", "彼はついに同僚からの圧力に屈した。"),
    "corroded": ("腐食した、蝕んだ", "動詞", "Salt water corroded the metal railing.", "塩水が金属の手すりを腐食させた。"),
    "disembarking": ("下船する、降りる", "動詞", "Passengers were disembarking from the ferry.", "乗客たちはフェリーから降りていた。"),
    "acquiescing": ("黙って従う、同意する", "動詞", "By acquiescing to the demand, he avoided a public dispute.", "その要求に黙って応じることで、彼は公の争いを避けた。"),
    "delving": ("掘り下げて調べる", "動詞", "The journalist is delving into the history of the company.", "その記者は会社の歴史を深く調べている。"),
    "infringing": ("侵害する", "動詞", "The new rule risks infringing on workers' rights.", "その新しい規則は労働者の権利を侵害する恐れがある。"),
    "coronation": ("戴冠式", "名詞", "The coronation attracted visitors from around the world.", "その戴冠式には世界中から観光客が集まった。"),
    "vogue": ("流行", "名詞", "Short videos came into vogue among younger users.", "短い動画が若い利用者の間で流行した。"),
    "maneuver": ("巧みな操作、策略", "名詞", "The pilot performed a difficult maneuver in the narrow valley.", "パイロットは狭い谷で難しい操作を行った。"),
    "protocol": ("手順、規定", "名詞", "The laboratory follows a strict safety protocol.", "その研究所は厳格な安全手順に従っている。"),
    "abort": ("中止する", "動詞", "The pilot had to abort the landing because of strong winds.", "強風のためパイロットは着陸を中止しなければならなかった。"),
    "reclaim": ("取り戻す、回収する", "動詞", "The city plans to reclaim the polluted land for a park.", "市は汚染された土地を公園として再生する計画だ。"),
    "pinpoint": ("正確に突き止める", "動詞", "Investigators could not pinpoint the source of the leak.", "捜査員たちは漏れの発生源を正確に突き止められなかった。"),
    "insulate": ("遮断する、断熱する", "動詞", "These materials insulate the house from outside noise.", "これらの素材は家を外部の騒音から遮断する。"),
    "exemplary": ("模範的な", "形容詞", "The nurse was praised for her exemplary care of patients.", "その看護師は患者への模範的なケアを称賛された。"),
    "haggard": ("やつれた、疲れ果てた", "形容詞", "After the long journey, he looked haggard.", "長旅の後、彼はやつれて見えた。"),
    "insipid": ("味気ない、面白みのない", "形容詞", "The speech was so insipid that few people remembered it.", "そのスピーチはあまりに味気なく、覚えている人はほとんどいなかった。"),
    "petulant": ("すねた、不機嫌な", "形容詞", "The petulant child complained about every small inconvenience.", "そのすねた子どもは小さな不便についていちいち不満を言った。"),
    "envoy": ("特使", "名詞", "The envoy delivered a message from the president.", "その特使は大統領からのメッセージを届けた。"),
    "allegory": ("寓話、寓意的な物語", "名詞", "The novel is an allegory about the dangers of political power.", "その小説は政治権力の危険性についての寓話だ。"),
    "gall": ("厚かましさ", "名詞", "He had the gall to blame me for his own mistake.", "彼は自分のミスを私のせいにする厚かましさがあった。"),
    "intrigue": ("陰謀、興味", "名詞", "The mystery and intrigue kept readers turning the pages.", "謎と陰謀が読者にページをめくらせ続けた。"),
    "reprisals": ("報復措置", "名詞", "The rebels feared reprisals after the attack.", "反乱軍は攻撃後の報復を恐れた。"),
    "provisos": ("条件、但し書き", "名詞", "She accepted the offer with two important provisos.", "彼女は二つの重要な条件付きでその申し出を受け入れた。"),
    "apexes": ("頂点", "名詞", "The two mountains have sharp, snow-covered apexes.", "その二つの山には雪に覆われた鋭い頂がある。"),
    "fringes": ("周辺、縁", "名詞", "Small villages lie on the fringes of the forest.", "小さな村々が森の周辺に位置している。"),
    "onslaught": ("猛攻、猛襲", "名詞", "The town prepared for an onslaught of winter storms.", "その町は冬の嵐の猛襲に備えた。"),
    "archipelago": ("群島", "名詞", "The country is made up of a beautiful tropical archipelago.", "その国は美しい熱帯の群島から成っている。"),
    "aberration": ("異常、逸脱", "名詞", "The unusually cold day was an aberration in the warm season.", "その異常に寒い日は暖かい季節の中での例外だった。"),
    "sham": ("見せかけ、偽物", "名詞", "The investigation revealed that the charity was a sham.", "調査によって、その慈善団体が見せかけだったことが明らかになった。"),
    "devouring": ("むさぼり食うこと", "動詞", "The children were devouring sandwiches after the game.", "子どもたちは試合後にサンドイッチをむさぼり食べていた。"),
    "cradling": ("抱える、そっと支える", "動詞", "She was cradling the injured bird in her hands.", "彼女は傷ついた鳥を両手でそっと抱えていた。"),
    "pondering": ("熟考する", "動詞", "He spent the evening pondering the difficult question.", "彼は夜、難しい問題を熟考して過ごした。"),
    "juxtaposing": ("並置する", "動詞", "The exhibition is juxtaposing old photographs with new ones.", "その展示会は古い写真と新しい写真を並べている。"),
    "negligent": ("怠慢な、過失のある", "形容詞", "The driver was negligent in checking the brakes.", "その運転手はブレーキの点検を怠った。"),
    "pedantic": ("細部にこだわる、学者ぶった", "形容詞", "His pedantic explanation made a simple idea seem complicated.", "彼の細部にこだわる説明は、簡単な考えを複雑に見せた。"),
    "dainty": ("繊細な、可憐な", "形容詞", "The child carefully held the dainty porcelain cup.", "その子は繊細な磁器のカップを注意深く持った。"),
    "introspective": ("内省的な", "形容詞", "Her introspective journal helped her understand her feelings.", "内省的な日記を書くことで、彼女は自分の気持ちを理解できた。"),
    "dabble in": ("〜にちょっと手を出す", "熟語", "She decided to dabble in photography during the summer.", "彼女は夏の間、写真撮影を少し始めることにした。"),
    "let down": ("失望させる", "熟語", "I promised not to let my team down.", "私はチームを失望させないと約束した。"),
    "put across": ("うまく伝える、売り込む", "熟語", "The speaker put across his idea in simple language.", "話し手は自分の考えを簡単な言葉でうまく伝えた。"),
    "farm out": ("外注する", "熟語", "The company farmed out the design work to a small studio.", "その会社はデザイン作業を小さなスタジオに外注した。"),
    "stumbled upon": ("偶然見つける", "熟語", "While walking through the market, she stumbled upon an old map.", "市場を歩いていると、彼女は古い地図を偶然見つけた。"),
    "chipped off": ("少しずつ削り取った、剥がした", "熟語", "The workers chipped off the old paint from the door.", "作業員たちはドアから古い塗料を少しずつ剥がした。"),
    "marked out": ("選び出した、目立たせた", "熟語", "The coach marked out three players for special praise.", "コーチは特に称賛する3人の選手を選び出した。"),
    "fawned over": ("へつらった、ちやほやした", "熟語", "The fans fawned over the actor outside the theater.", "ファンたちは劇場の外でその俳優をちやほやした。"),
    "laid on": ("加えた、施した", "熟語", "The caterer laid on an excellent meal for the guests.", "仕出し業者は客のために素晴らしい食事を用意した。"),
    "keyed up": ("興奮して、高揚して", "熟語", "The players were keyed up before the championship game.", "選手たちは決勝戦を前に気持ちが高ぶっていた。"),
    "banked on": ("〜を当てにした", "熟語", "We banked on good weather for the outdoor concert.", "私たちは屋外コンサートのために良い天気を当てにした。"),
    "held down": ("抑えた、押さえつけた", "熟語", "The nurse held down the patient's arm during the procedure.", "看護師は処置中、患者の腕を押さえた。"),
    "backed out": ("手を引いた、約束を撤回した", "熟語", "The buyer backed out of the deal at the last minute.", "買い手は土壇場でその取引から手を引いた。"),
    "flipped out": ("ひどく取り乱した、激怒した", "熟語", "She flipped out when she saw the damage to her car.", "彼女は自分の車の損傷を見てひどく取り乱した。"),
    "squeaked by": ("かろうじて通過した、勝った", "熟語", "Our team squeaked by with a one-point victory.", "私たちのチームは1点差でかろうじて勝った。"),
    "sank in": ("理解される、実感される", "熟語", "It took a few days for the news to sink in.", "その知らせが実感として理解されるまで数日かかった。"),
}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build() -> tuple[dict, dict]:
    if len(QUESTIONS) != 25:
        raise ValueError("模試 第3回は25問である必要があります")
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
        "source": "ユーザー提供の模試原稿（模試 第3回）を学習用JSONへ構造化",
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
    write_json(DATA_DIR / "vocab_1_mock-3.json", vocab)
    write_json(DATA_DIR / "questions_1_mock-3.json", questions)
    print("mock-3: 25 questions / 100 items (84 words, 16 idioms)")


if __name__ == "__main__":
    main()
