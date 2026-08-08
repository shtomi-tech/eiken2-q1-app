"""ユーザー提供の英検1級「模試 第1回」をQ1形式へ変換する。"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ROUND_ID = "mock-1"


QUESTIONS = [
    {
        "stem": "Joey took a bad fall while he was snowboarding earlier this month. He hit his head, suffering a mild ( ). Doctors advised him to always wear a helmet in the future.",
        "choices": ["concussion", "infraction", "preclusion", "retribution"],
        "answerIndex": 0,
        "translation": "ジョーイは今月初め、スノーボード中にひどく転んだ。頭を打ち、軽い脳震盪を起こした。医師は今後必ずヘルメットを着用するよう助言した。",
    },
    {
        "stem": "In ( ), I probably should have finished college, but at the time all I could think about was traveling the world and meeting new people.",
        "choices": ["thrift", "affability", "dud", "retrospect"],
        "answerIndex": 3,
        "translation": "振り返ってみると、私はおそらく大学を卒業しておくべきだったが、当時は世界を旅して新しい人々に会うことしか考えられなかった。",
    },
    {
        "stem": "A: Diane, you have such good posture.\nB: Thank you. It's probably because my mom was always telling me to stop ( ) as a child.",
        "choices": ["darting", "slouching", "wedging", "defecting"],
        "answerIndex": 1,
        "translation": "A：ダイアン、姿勢がとてもいいね。\nB：ありがとう。子どものころ、母にいつも猫背をやめなさいと言われていたからだと思う。",
    },
    {
        "stem": "This new car-sharing app ( ) the recently popular sharing economy. It is a great example of how people are using technology to come together and help one another.",
        "choices": ["exhorts", "typifies", "dispirits", "omits"],
        "answerIndex": 1,
        "translation": "この新しいカーシェアリングアプリは、最近人気のシェアリングエコノミーを典型的に示している。人々がテクノロジーを使って集まり、助け合っている好例だ。",
    },
    {
        "stem": 'A: Hey, have you seen what they\'re saying on the news about Saving Our Kids?\nB: Yeah, that\'s really horrible. All these years they\'ve been taking charitable donations, but really it was all just a ( ).',
        "choices": ["clemency", "demise", "melancholy", "scam"],
        "answerIndex": 3,
        "translation": "A：Saving Our Kidsについてニュースで何と言われているか見た？\nB：うん、本当にひどいね。何年も慈善寄付を集めていたけれど、実は全部ただの詐欺だったんだ。",
    },
    {
        "stem": 'A: This is the dirtiest hotel I\'ve ever seen.\nB: Yeah, I think "Greenhill Luxury Suites" is a bit of a ( ). They should rename it "Garbage Rooms."',
        "choices": ["supposition", "quirk", "misnomer", "wrench"],
        "answerIndex": 2,
        "translation": "A：こんなに汚いホテルは初めて見た。\nB：そうだね。「グリーンヒル・ラグジュアリー・スイーツ」という名前は少し誤称だと思う。「ごみ部屋」に改名すべきだよ。",
    },
    {
        "stem": "After he managed to land the malfunctioning plane, the pilot was immediately ( ). They wanted to know exactly what had gone wrong during the flight.",
        "choices": ["filtered", "alleged", "tethered", "debriefed"],
        "answerIndex": 3,
        "translation": "故障した飛行機を何とか着陸させた後、パイロットはすぐに事情聴取を受けた。彼らは飛行中に何が起きたのかを正確に知りたかった。",
    },
    {
        "stem": "I got to visit the executive's condo in New York last weekend, which was just as ( ) as the man himself. It was stylish, clean, and clearly worth a lot of money.",
        "choices": ["abominable", "impertinent", "lethal", "sleek"],
        "answerIndex": 3,
        "translation": "先週末、ニューヨークにあるその重役のマンションを訪ねたが、本人と同じくらい洗練されていた。おしゃれで清潔で、明らかに高価だった。",
    },
    {
        "stem": "Only ten years ago, this technology was still quite ( ), and although it may seem advanced now, we are still only seeing a fraction of its true potential.",
        "choices": ["torrid", "irresolute", "rudimentary", "amenable"],
        "answerIndex": 2,
        "translation": "わずか10年前、この技術はまだかなり初歩的だった。今は先進的に見えるかもしれないが、私たちはまだ本当の可能性のほんの一部しか見ていない。",
    },
    {
        "stem": "A: It seems that Dr. Rogers isn't very popular among the other researchers.\nB: That's because he often shows ( ) in his remarks about what we do here. Our research is supposed to be top-secret.",
        "choices": ["stipulation", "provision", "annotation", "indiscretion"],
        "answerIndex": 3,
        "translation": "A：ロジャース博士は他の研究者たちにあまり人気がないようだね。\nB：ここで行っていることについて、発言で軽率に秘密を漏らすことが多いからだよ。私たちの研究は極秘のはずなのに。",
    },
    {
        "stem": "When Marissa found herself alone with the famous author, she ( ) on the opportunity to ask him questions about how to write good stories.",
        "choices": ["splashed", "hastened", "capitalized", "relented"],
        "answerIndex": 2,
        "translation": "マリッサは有名な作家と二人きりになると、よい物語の書き方について質問する機会を活用した。",
    },
    {
        "stem": "The mayor's popularity has ( ) throughout the year, as he has experienced times of both widespread admiration and considerable criticism.",
        "choices": ["fluctuated", "bolted", "deteriorated", "chuckled"],
        "answerIndex": 0,
        "translation": "市長は広く称賛される時期と激しく批判される時期の両方を経験し、年間を通じて人気が変動した。",
    },
    {
        "stem": "Jennifer did not realize that her work visa was no longer valid after changing jobs, and she faced ( ) for overstaying her visa.",
        "choices": ["deportation", "insurrection", "elocution", "disposition"],
        "answerIndex": 0,
        "translation": "ジェニファーは転職後、就労ビザがもう有効でないことに気づかず、滞在期間を超過したため強制送還に直面した。",
    },
    {
        "stem": "There were a few times when Marvin was sure that their business was going to fail, but his partner's ( ) attitude helped him to stay positive, and in the end the company was a huge success.",
        "choices": ["penitent", "studious", "soggy", "irrepressible"],
        "answerIndex": 3,
        "translation": "マービンが事業は失敗すると確信したことが何度かあったが、パートナーの抑えきれないほど前向きな態度が彼を明るく保ち、結局会社は大成功した。",
    },
    {
        "stem": "The woman was arrested by border authorities when she tried to use ( ) travel documents to gain access to the country.",
        "choices": ["roguish", "cerebral", "intricate", "fraudulent"],
        "answerIndex": 3,
        "translation": "その女性は入国するために偽造された旅行書類を使おうとして、国境当局に逮捕された。",
    },
    {
        "stem": "Everyone in the sales team was shocked when the new representative had the ( ) to blame their manager instead of acknowledging his own mistake.",
        "choices": ["spillage", "gristle", "audacity", "rehash"],
        "answerIndex": 2,
        "translation": "新しい担当者が自分の過ちを認めず、上司を責めるとは、その営業チームの全員がその厚かましさに驚いた。",
    },
    {
        "stem": "At that age, the baby birds are still not able to eat solid food, so the mother eats it first, then ( ) it for them to eat.",
        "choices": ["regurgitates", "illuminates", "truncates", "fumigates"],
        "answerIndex": 0,
        "translation": "その年齢では、ひな鳥はまだ固形物を食べられないため、母鳥が先に食べてから、ひなたちのために吐き戻す。",
    },
    {
        "stem": "A: How much does it cost to apply?\nB: Usually it costs $80. However, the school will ( ) the application fee for any low-income students.",
        "choices": ["exude", "debilitate", "waive", "diversify"],
        "answerIndex": 2,
        "translation": "A：申し込みにはいくらかかりますか。\nB：通常は80ドルです。ただし、学校は低所得の学生について申請料を免除します。",
    },
    {
        "stem": "They gave her the medicine via an ( ) drip, as that was more effective than taking it orally.",
        "choices": ["illustrious", "imperious", "extraneous", "intravenous"],
        "answerIndex": 3,
        "translation": "経口で服用するより効果的だったため、彼らは静脈内点滴で彼女に薬を投与した。",
    },
    {
        "stem": "After the car accident, doctors told Matthew that he'd be lucky to ever walk again, let alone run. However, he overcame seemingly ( ) odds, and ten years later he ran his first marathon.",
        "choices": ["insurmountable", "insolent", "roundabout", "senile"],
        "answerIndex": 0,
        "translation": "交通事故の後、医師はマシューに、走るどころか再び歩けたら幸運だと言った。しかし彼は一見克服不可能な困難を乗り越え、10年後には初めてマラソンを走った。",
    },
    {
        "stem": "After Rudy's son got into a fight with a bully at school, he told his son that, although he didn't ( ) violence, he sympathized with his desire to protect his classmate.",
        "choices": ["invert", "condone", "mortify", "embroil"],
        "answerIndex": 1,
        "translation": "ルディの息子が学校でいじめっ子とけんかをした後、ルディは暴力を容認はしないが、同級生を守りたい気持ちには共感すると息子に伝えた。",
    },
    {
        "stem": "The police have started ( ) on drunk drivers. Arrests for drinking and driving have gone up over 200% in the last month.",
        "choices": ["carrying over", "cracking down", "hanging out", "wasting away"],
        "answerIndex": 1,
        "translation": "警察は飲酒運転者の厳しい取り締まりを始めた。飲酒運転による逮捕者は先月、200％以上増加した。",
    },
    {
        "stem": "A: ( ) it, Wendy! If we don't finish this project tonight, we're going to fail this class.\nB: Sorry, Meg. I just keep thinking about what Vince said to me earlier.",
        "choices": ["Snap out of", "Act up to", "Hold out on", "Stand up to"],
        "answerIndex": 0,
        "translation": "A：ウェンディ、しっかりして！今夜この課題を終えなければ、この授業に落ちてしまうよ。\nB：ごめん、メグ。さっきヴィンスに言われたことが頭から離れないの。",
    },
    {
        "stem": "Steve tried to ( ) the reasons for his decision to quit his job, but his wife was not interested in hearing his explanation.",
        "choices": ["lay out", "drum up", "settle on", "seal off"],
        "answerIndex": 0,
        "translation": "スティーブは仕事を辞める決断の理由を説明しようとしたが、妻は彼の説明を聞くことに関心がなかった。",
    },
    {
        "stem": "A: I told my boss that I noticed some money missing from one of our accounts, and he offered to give me a raise if I just ignored it.\nB: He thinks that you can just be ( ) like that? What did you say to him?",
        "choices": ["bargained on", "bought off", "eked out", "soaked up"],
        "answerIndex": 1,
        "translation": "A：口座の一つからお金がなくなっていることに気づいたと上司に伝えたら、見て見ぬふりをすれば昇給すると言われた。\nB：そんなふうに買収できると思っているの？何て答えたの？",
    },
]


DETAILS = {
    "concussion": ("脳震盪", "名詞", "The doctor diagnosed him with a mild concussion after the fall.", "医師は転倒後、彼を軽い脳震盪と診断した。"),
    "infraction": ("（規則の）違反", "名詞", "The referee called the late tackle an infraction.", "審判は遅れて入ったタックルを反則と判定した。"),
    "preclusion": ("排除、妨げ", "名詞", "The rule allows preclusion of applicants who submit false documents.", "その規則は、虚偽の書類を提出した申請者を排除することを認めている。"),
    "retribution": ("報復、仕返し", "名詞", "The attack was presented as retribution for the earlier bombing.", "その攻撃は、先の爆撃への報復として説明された。"),
    "thrift": ("倹約", "名詞", "Her thrift allowed her to save enough for a small house.", "彼女は倹約によって小さな家を買えるだけのお金を貯めた。"),
    "affability": ("愛想のよさ、親しみやすさ", "名詞", "The host's affability made every guest feel welcome.", "司会者の愛想のよさで、すべての客が歓迎されていると感じた。"),
    "dud": ("失敗作、役立たず", "名詞", "The expensive gadget turned out to be a dud.", "その高価な機器は、結局のところ失敗作だった。"),
    "retrospect": ("回顧、振り返って", "名詞", "In retrospect, taking that job was the right decision.", "振り返ってみると、あの仕事を受けたのは正しい決断だった。"),
    "darting": ("素早く走る、突進する", "動詞", "A rabbit was darting across the field.", "ウサギが野原を素早く横切っていた。"),
    "slouching": ("前かがみでだらしなく座ること", "動詞", "Slouching at a desk can cause back pain.", "机で前かがみになると、背中が痛くなることがある。"),
    "wedging": ("差し込む、押し込む", "動詞", "He was wedging a chair under the door handle.", "彼はドアの取っ手の下に椅子を押し込んでいた。"),
    "defecting": ("離反すること", "動詞", "The spy was arrested while defecting to the other side.", "そのスパイは相手側へ離反しようとして逮捕された。"),
    "exhorts": ("強く促す、激励する", "動詞", "The coach exhorts the players to keep trying.", "コーチは選手たちに挑戦し続けるよう強く促す。"),
    "typifies": ("典型的に示す", "動詞", "This quiet village typifies life in the northern region.", "この静かな村は北部地域の暮らしを典型的に示している。"),
    "dispirits": ("落胆させる", "動詞", "A single defeat does not dispirit the determined team.", "一度の敗北で、その意志の強いチームが落胆することはない。"),
    "omits": ("省く、記載しない", "動詞", "The report omits several important details.", "その報告書はいくつかの重要な詳細を省いている。"),
    "clemency": ("慈悲、寛大な処置", "名詞", "The prisoner appealed to the governor for clemency.", "その囚人は知事に慈悲を求めた。"),
    "demise": ("死、終焉", "名詞", "The newspaper reported the demise of the old theater.", "その新聞は古い劇場の終焉を報じた。"),
    "melancholy": ("憂鬱、物悲しさ", "名詞", "The empty station filled her with melancholy.", "無人の駅を見て、彼女は物悲しい気持ちになった。"),
    "scam": ("詐欺", "名詞", "The email was a scam designed to steal bank details.", "そのメールは銀行情報を盗むための詐欺だった。"),
    "supposition": ("仮定、推測", "名詞", "His conclusion was based on a supposition rather than evidence.", "彼の結論は証拠ではなく推測に基づいていた。"),
    "quirk": ("風変わりな癖", "名詞", "One quirk of the old clock is that it rings twice at noon.", "その古時計の風変わりな癖の一つは、正午に2回鳴ることだ。"),
    "misnomer": ("誤った名称、誤称", "名詞", "Calling the tiny room a ballroom is a misnomer.", "その小さな部屋を舞踏室と呼ぶのは誤称だ。"),
    "wrench": ("激しい苦痛；ねじる道具", "名詞", "Leaving her hometown was an emotional wrench.", "故郷を離れることは精神的に大きな苦痛だった。"),
    "filtered": ("ろ過した、選別した", "動詞", "The technician filtered the water before testing it.", "技術者は検査前に水をろ過した。"),
    "alleged": ("申し立てられた、 alleged の", "形容詞", "The alleged thief denied taking the necklace.", "容疑者とされた泥棒はネックレスを盗んだことを否定した。"),
    "tethered": ("つなぎ留めた", "動詞", "The hikers tethered the horses near the river.", "ハイカーたちは川の近くで馬をつないだ。"),
    "debriefed": ("任務後に事情聴取した", "動詞", "The rescue team was debriefed after returning to base.", "救助隊は基地に戻った後、任務について報告を求められた。"),
    "abominable": ("非常にひどい、忌まわしい", "形容詞", "The restaurant received an abominable safety rating.", "そのレストランは非常にひどい安全評価を受けた。"),
    "impertinent": ("生意気な、無礼な", "形容詞", "The clerk was dismissed for making an impertinent remark.", "その店員は生意気な発言をしたため解雇された。"),
    "lethal": ("致命的な", "形容詞", "The snake's bite can be lethal without treatment.", "そのヘビのかみ傷は、治療しなければ致命的になることがある。"),
    "sleek": ("なめらかで洗練された", "形容詞", "The company launched a sleek new electric car.", "その会社は洗練された新しい電気自動車を発表した。"),
    "torrid": ("猛暑の、灼熱の", "形容詞", "The runners struggled through a torrid afternoon.", "ランナーたちは猛暑の午後に苦戦した。"),
    "irresolute": ("優柔不断な", "形容詞", "The irresolute manager kept postponing the decision.", "その優柔不断な管理職は決定を先延ばしにし続けた。"),
    "rudimentary": ("初歩的な、未発達な", "形容詞", "The village had only rudimentary medical facilities.", "その村には初歩的な医療設備しかなかった。"),
    "amenable": ("受け入れやすい、従順な", "形容詞", "The committee was amenable to a reasonable compromise.", "委員会は妥当な妥協案を受け入れる用意があった。"),
    "stipulation": ("条件、規定", "名詞", "The contract includes a stipulation about working hours.", "その契約には勤務時間に関する条件が含まれている。"),
    "provision": ("条項、備え", "名詞", "The law contains a provision for emergency aid.", "その法律には緊急支援の条項がある。"),
    "annotation": ("注釈", "名詞", "The professor added an annotation to the difficult passage.", "教授は難しい箇所に注釈を加えた。"),
    "indiscretion": ("軽率な言動、秘密漏洩", "名詞", "His indiscretion revealed the confidential plan.", "彼の軽率な言動によって秘密の計画が明らかになった。"),
    "splashed": ("はねかけた", "動詞", "The passing truck splashed mud on my coat.", "通り過ぎたトラックが私のコートに泥をはねかけた。"),
    "hastened": ("急いだ、促進した", "動詞", "She hastened to the station when she heard the announcement.", "彼女はアナウンスを聞くと駅へ急いだ。"),
    "capitalized": ("利用した、活用した", "動詞", "The small shop capitalized on the sudden tourist boom.", "その小さな店は突然の観光客増加を活用した。"),
    "relented": ("折れた、態度を和らげた", "動詞", "The teacher finally relented and extended the deadline.", "先生はついに折れて締め切りを延ばした。"),
    "fluctuated": ("変動した", "動詞", "Oil prices fluctuated sharply during the crisis.", "危機の間、石油価格は大きく変動した。"),
    "bolted": ("急に走り去った", "動詞", "The startled horse bolted toward the open field.", "驚いた馬は開けた野原へ急に走り去った。"),
    "deteriorated": ("悪化した", "動詞", "His condition deteriorated during the night.", "彼の容体は夜の間に悪化した。"),
    "chuckled": ("くすくす笑った", "動詞", "Grandfather chuckled at the child's clever answer.", "祖父は子どもの賢い答えを聞いてくすくす笑った。"),
    "deportation": ("強制送還", "名詞", "The court ordered his deportation after the visa violation.", "裁判所はビザ違反の後、彼の強制送還を命じた。"),
    "insurrection": ("反乱、暴動", "名詞", "The government declared a state of emergency after the insurrection.", "政府は反乱の後、非常事態を宣言した。"),
    "elocution": ("発音・朗読法", "名詞", "The actor took elocution lessons before the play opened.", "その俳優は初演前に発音・朗読法のレッスンを受けた。"),
    "disposition": ("気質、処分", "名詞", "Her cheerful disposition helped the team through the difficult week.", "彼女の明るい気質が、困難な週を乗り切るチームの助けになった。"),
    "penitent": ("悔い改めた、後悔している", "形容詞", "The penitent student apologized to the class.", "その後悔した生徒はクラスに謝った。"),
    "studious": ("勉強熱心な", "形容詞", "Her studious habits earned her a scholarship.", "彼女は勉強熱心だったため奨学金を得た。"),
    "soggy": ("びしょ濡れの、ふやけた", "形容詞", "The soggy newspaper fell apart in my hands.", "びしょ濡れの新聞は手の中でばらばらになった。"),
    "irrepressible": ("抑えきれない、非常に前向きな", "形容詞", "His irrepressible enthusiasm encouraged everyone around him.", "彼の抑えきれない熱意が周囲の全員を勇気づけた。"),
    "roguish": ("いたずらっぽい", "形容詞", "The child gave us a roguish smile.", "その子どもは私たちにいたずらっぽい笑顔を見せた。"),
    "cerebral": ("脳の、知的な", "形容詞", "The injury caused serious cerebral damage.", "そのけがは深刻な脳損傷を引き起こした。"),
    "intricate": ("複雑な、入り組んだ", "形容詞", "The artist designed an intricate pattern for the tile.", "その芸術家はタイルに複雑な模様をデザインした。"),
    "fraudulent": ("不正な、詐欺的な", "形容詞", "The bank blocked the fraudulent transaction.", "銀行は不正な取引を阻止した。"),
    "spillage": ("流出、こぼれ", "名詞", "The crew cleaned up the chemical spillage immediately.", "乗組員は化学物質の流出を直ちに処理した。"),
    "gristle": ("軟骨", "名詞", "The old dog had trouble chewing the tough gristle.", "その老犬は硬い軟骨をかむのに苦労した。"),
    "audacity": ("厚かましい大胆さ", "名詞", "I was surprised by her audacity in challenging the director.", "私は、彼女が監督に意見した大胆さに驚いた。"),
    "rehash": ("焼き直し", "名詞", "The sequel felt like a rehash of the first movie.", "その続編は1作目の焼き直しのように感じられた。"),
    "regurgitates": ("吐き戻す、逆流させる", "動詞", "The parent bird regurgitates food for its chicks.", "親鳥はひなたちのために食べ物を吐き戻す。"),
    "illuminates": ("照らす、明らかにする", "動詞", "The diagram illuminates the structure of the machine.", "その図は機械の構造を明らかにする。"),
    "truncates": ("切り詰める、省略する", "動詞", "The program truncates long file names automatically.", "そのプログラムは長いファイル名を自動的に切り詰める。"),
    "fumigates": ("燻蒸消毒する", "動詞", "The company fumigates the warehouse once a year.", "その会社は年に一度、倉庫を燻蒸消毒する。"),
    "exude": ("にじみ出る、発散する", "動詞", "The flowers exude a sweet fragrance at night.", "その花は夜に甘い香りを発散する。"),
    "debilitate": ("弱らせる", "動詞", "A long illness can debilitate even a strong athlete.", "長い病気は強い運動選手でさえ弱らせることがある。"),
    "waive": ("放棄する、免除する", "動詞", "The hotel agreed to waive the cancellation fee.", "ホテルはキャンセル料を免除することに同意した。"),
    "diversify": ("多様化する", "動詞", "The company plans to diversify its product line.", "その会社は製品ラインを多様化する計画だ。"),
    "illustrious": ("著名な、輝かしい", "形容詞", "The museum honors the illustrious scientist every year.", "その博物館は毎年、その著名な科学者をたたえている。"),
    "imperious": ("横柄な、尊大な", "形容詞", "His imperious tone annoyed the entire staff.", "彼の横柄な口調はスタッフ全員をいら立たせた。"),
    "extraneous": ("余分な、無関係な", "形容詞", "Please remove any extraneous information from the summary.", "要約から余分な情報を取り除いてください。"),
    "intravenous": ("静脈内の", "形容詞", "The patient received intravenous fluids after the operation.", "患者は手術後、静脈内輸液を受けた。"),
    "insurmountable": ("克服できない、乗り越えがたい", "形容詞", "The team found a way around what seemed like an insurmountable obstacle.", "チームは克服不可能に見えた障害を乗り越える方法を見つけた。"),
    "insolent": ("生意気な、横柄な", "形容詞", "The insolent student refused to follow the simple instruction.", "その生意気な生徒は簡単な指示に従うことを拒んだ。"),
    "roundabout": ("遠回りの、間接的な", "形容詞", "We took a roundabout route to avoid the traffic.", "私たちは渋滞を避けるため遠回りの道を通った。"),
    "senile": ("老衰した、老年性の", "形容詞", "The novel portrays a senile king losing his grip on power.", "その小説は、権力を失っていく老衰した王を描いている。"),
    "invert": ("逆さにする、反転する", "動詞", "Invert the bottle before opening it.", "開ける前に瓶を逆さにしてください。"),
    "condone": ("大目に見る、容認する", "動詞", "The school will not condone bullying of any kind.", "学校はいかなる種類のいじめも容認しない。"),
    "mortify": ("屈辱を与える、悔しがらせる", "動詞", "The public mistake mortified the young speaker.", "公の場での間違いは若い講演者に屈辱を与えた。"),
    "embroil": ("巻き込む", "動詞", "The dispute could embroil several neighboring countries.", "その紛争は近隣諸国をいくつも巻き込む可能性がある。"),
    "carrying over": ("持ち越す", "熟語", "The unused budget is carrying over to the next quarter.", "未使用の予算は次の四半期へ持ち越される。"),
    "cracking down": ("厳しく取り締まる", "熟語", "The city is cracking down on illegal parking.", "市は違法駐車を厳しく取り締まっている。"),
    "hanging out": ("ぶらぶら過ごす、遊ぶ", "熟語", "We spent the afternoon hanging out at the park.", "私たちは午後を公園でぶらぶら過ごした。"),
    "wasting away": ("やせ衰える、衰弱する", "熟語", "Without proper care, the abandoned garden was wasting away.", "適切な世話がなく、その放置された庭は衰えていった。"),
    "Snap out of": ("ぼんやりした状態から立ち直る", "熟語", "You need to snap out of your gloomy mood and face the problem.", "憂鬱な気分から立ち直って、問題に向き合う必要がある。"),
    "Act up to": ("期待に応えて行動する", "熟語", "The young player acted up to the high expectations placed on him.", "その若い選手は寄せられた大きな期待に応えて行動した。"),
    "Hold out on": ("隠して与えない、出し惜しみする", "熟語", "Please do not hold out on us when you know the answer.", "答えを知っているなら、私たちに隠さないでください。"),
    "Stand up to": ("立ち向かう", "熟語", "She stood up to the bully and reported the incident.", "彼女はいじめっ子に立ち向かい、その出来事を報告した。"),
    "lay out": ("説明する、明確に示す", "熟語", "The lawyer laid out the risks before we signed the contract.", "弁護士は私たちが契約に署名する前にリスクを説明した。"),
    "drum up": ("（支持・仕事など）をかき集める", "熟語", "The campaign tried to drum up support from local residents.", "その運動は地元住民から支持を集めようとした。"),
    "settle on": ("～に決める", "熟語", "After comparing several plans, we settled on the simplest one.", "いくつかの計画を比較した後、私たちは最も簡単なものに決めた。"),
    "seal off": ("封鎖する、立ち入り禁止にする", "熟語", "Police sealed off the street after the accident.", "警察は事故の後、その通りを封鎖した。"),
    "bargained on": ("当てにした、予期した", "熟語", "We had not bargained on such a long delay.", "私たちはこれほど長い遅延を予期していなかった。"),
    "bought off": ("買収した、金で黙らせた", "熟語", "The company tried to buy off the witness with a large payment.", "その会社は多額の支払いで証人を買収しようとした。"),
    "eked out": ("かろうじて得た、やりくりした", "熟語", "She eked out a living by repairing old bicycles.", "彼女は古い自転車を修理して、かろうじて生計を立てた。"),
    "soaked up": ("吸収した、十分に味わった", "熟語", "The children soaked up every detail of the science show.", "子どもたちは科学ショーの細部をすべて吸収した。"),
}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build() -> tuple[dict, dict]:
    if len(QUESTIONS) != 25:
        raise ValueError("模試 第1回は25問である必要があります")
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
        "source": "ユーザー提供の模試原稿（模試 第1回）を学習用JSONへ構造化",
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
    write_json(DATA_DIR / "vocab_1_mock-1.json", vocab)
    write_json(DATA_DIR / "questions_1_mock-1.json", questions)
    print("mock-1: 25 questions / 100 items (84 words, 16 idioms)")


if __name__ == "__main__":
    main()
