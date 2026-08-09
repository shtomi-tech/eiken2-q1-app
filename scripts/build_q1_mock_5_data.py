"""ユーザー提供の英検1級「模試 第5回」をQ1形式へ変換する。"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ROUND_ID = "mock-5"


QUESTIONS = [
    {"stem": "Melissa didn't like getting a lot of attention, so she wrote her novels under a ( ). None of her friends knew that she was a famous author.", "choices": ["pseudonym", "pasture", "repose", "precipitation"], "answerIndex": 0, "translation": "メリッサは注目を集めるのが好きではなかったので、筆名で小説を書いていた。彼女の友人は誰も、彼女が有名な作家だとは知らなかった。"},
    {"stem": "Ernest ( ) at his wife's suggestion to go to an expensive restaurant downtown. \"It's a waste of money,\" he said.", "choices": ["quivered", "plummeted", "bulged", "balked"], "answerIndex": 3, "translation": "アーネストは妻から街の高級レストランへ行こうと提案されて、難色を示した。「お金の無駄だ」と彼は言った。"},
    {"stem": "Whenever Joe's wife made curry, the smell ( ) the entire house. So he knew that she was making curry the moment he opened the front door.", "choices": ["professed", "waylaid", "permeated", "detonated"], "answerIndex": 2, "translation": "ジョーの妻がカレーを作ると、いつもその匂いが家全体に行き渡った。そのため、玄関を開けた瞬間に彼女がカレーを作っていると分かった。"},
    {"stem": "In order for your computer to run at ( ) speed, it needs to be kept cool. When the temperature gets too high, performance will begin to drop.", "choices": ["incompetent", "imminent", "optimum", "stolid"], "answerIndex": 2, "translation": "コンピューターを最適な速度で動かすには、冷たく保つ必要がある。温度が高くなりすぎると、性能が低下し始める。"},
    {"stem": "A: This is really bad. The CEO is all over the news for being involved in that government scandal.\nB: I wonder if the board of directors is going to fire him. He's become a ( ) to the company.", "choices": ["maxim", "synthesis", "strife", "liability"], "answerIndex": 3, "translation": "A：これは本当にまずい。CEOが政府のスキャンダルに関わったことで、ニュースで大きく報じられている。\nB：取締役会は彼を解雇するのだろうか。彼は会社にとって負担になっている。"},
    {"stem": "A: Is it safe to send private information using this software?\nB: Yes, it's totally safe. The software automatically ( ) the message to prevent outside sources from being able to read it.", "choices": ["encrypts", "affixes", "decrees", "proscribes"], "answerIndex": 0, "translation": "A：このソフトウェアを使って個人情報を送っても安全ですか？\nB：はい、完全に安全です。外部の人が読めないよう、ソフトウェアが自動的にメッセージを暗号化します。"},
    {"stem": "By encouraging residents to get to know their neighbors and participate in local charity projects, the organization is hoping to create more ( ) communities.", "choices": ["cranky", "painstaking", "superfluous", "cohesive"], "answerIndex": 3, "translation": "住民に近所の人と知り合い、地域の慈善活動に参加するよう促すことで、その団体はより結束した地域社会を作ろうとしている。"},
    {"stem": "A: Do they pay you a good salary?\nB: Not really. The ( ) are fantastic, though. I get to use a company car, and they provide me with really great health insurance.", "choices": ["delusions", "gripes", "perks", "hitches"], "answerIndex": 2, "translation": "A：給料はよいの？\nB：それほどでもないよ。でも福利厚生はすばらしい。社用車を使えるし、とてもよい健康保険も付いている。"},
    {"stem": "With their win on Friday, the basketball team has ( ) their spot in the playoffs. Their first playoff game will be the second week of February.", "choices": ["diced", "fazed", "clinched", "condensed"], "answerIndex": 2, "translation": "金曜日の勝利により、そのバスケットボールチームはプレーオフ出場の座を確定させた。最初のプレーオフ試合は2月の第2週になる。"},
    {"stem": "A: Jane bought another purse?\nB: I'm not surprised. She is always so ( ) with her parents' money.", "choices": ["definitive", "cavalier", "fiendish", "retentive"], "answerIndex": 1, "translation": "A：ジェーンはまたバッグを買ったの？\nB：驚かないよ。彼女はいつも親のお金を軽率に扱っているから。"},
    {"stem": "Experts say that the rare bird is ( ) on the edge of extinction. They warn that if something isn't done soon, then the species could be gone from the earth in only a few years.", "choices": ["teetering", "twitching", "matriculating", "sheering"], "answerIndex": 0, "translation": "専門家によると、その珍しい鳥は絶滅の瀬戸際で危うい状態にある。すぐに対策を取らなければ、数年で地球上から姿を消す可能性があると警告している。"},
    {"stem": "According to reports from board members, negotiations for the agreement have reached an ( ), and it now seems unlikely that the companies are going to merge, after all.", "choices": ["insignia", "indictment", "impasse", "auspice"], "answerIndex": 2, "translation": "取締役会のメンバーによると、その合意に向けた交渉は行き詰まりに達し、結局、両社が合併する可能性は低そうだ。"},
    {"stem": "The CEO tried to ( ) his employees with confidence during the company's difficult times. \"We will get through this,\" he assured them.", "choices": ["banish", "procure", "stump", "infuse"], "answerIndex": 3, "translation": "会社が困難な時期にある中、CEOは従業員に自信を吹き込もうとした。「私たちはこれを乗り越えられる」と彼らを安心させた。"},
    {"stem": "A: Wow, you look so tired.\nB: Yeah, I didn't sleep at all. My neighbors had a huge party last night, and the ( ) noise kept me up until four this morning.", "choices": ["prudent", "mutinous", "delectable", "unrelenting"], "answerIndex": 3, "translation": "A：わあ、とても疲れているように見えるね。\nB：ああ、まったく眠れなかった。昨夜、隣人が大きなパーティーを開いて、絶え間ない騒音で朝4時まで眠れなかったんだ。"},
    {"stem": "There is a long-standing ( ) between Colleen and her husband about how they should educate their children. She thinks they should go to private school, but he wants them to go to public school.", "choices": ["gait", "feud", "whim", "rig"], "answerIndex": 1, "translation": "コリーンと夫の間には、子どもたちをどう教育すべきかをめぐる長年の確執がある。彼女は私立学校に行かせるべきだと思っているが、夫は公立学校を望んでいる。"},
    {"stem": "Timothy is a somewhat ( ) student. It's clear that he is intelligent, but he often ignores homework assignments, and he doesn't seem to care about his grades at all.", "choices": ["wayward", "inconspicuous", "spellbound", "intrepid"], "answerIndex": 0, "translation": "ティモシーは少し気まぐれで手に負えない生徒だ。頭がよいのは明らかだが、宿題をよく無視し、成績をまったく気にしていないようだ。"},
    {"stem": "After the crisis, the government declared a ( ) on nuclear power. Nuclear plants across the country would be shut down until more reliable safeguards could be developed.", "choices": ["blister", "footage", "moratorium", "snare"], "answerIndex": 2, "translation": "危機の後、政府は原子力発電の一時停止を宣言した。より信頼できる安全対策が開発されるまで、全国の原子力発電所は停止されることになった。"},
    {"stem": "Although he studied French every day, Freddy had no chances to use it in daily life. So, when a group of French tourists came into his shop, he ( ) in the opportunity to test his skills.", "choices": ["reveled", "bellowed", "cantered", "trickled"], "answerIndex": 0, "translation": "フレディは毎日フランス語を勉強していたが、日常生活で使う機会がなかった。だからフランス人観光客の一団が店に入ってきたとき、技能を試せる機会を大いに楽しんだ。"},
    {"stem": "After having her wisdom teeth removed, the dentist warned Eliza that her mouth would probably begin hurting once the ( ) wore off.", "choices": ["anesthetic", "specter", "ordinance", "proponent"], "answerIndex": 0, "translation": "親知らずを抜いた後、歯科医はエリザに、麻酔薬が切れると口が痛み始めるだろうと警告した。"},
    {"stem": "A: Troy's son is such a ( ) child.\nB: I know, right? He can already build websites, and he's only nine years old!", "choices": ["precocious", "capricious", "scrupulous", "treacherous"], "answerIndex": 0, "translation": "A：トロイの息子は本当に早熟な子どもだね。\nB：そうだよね。まだ9歳なのに、もうウェブサイトを作れるんだよ。"},
    {"stem": "After it was revealed that Janet had been cheating on her husband, many of their mutual friends began to ( ) her. It was clear that they were on his side, not hers.", "choices": ["nurture", "exasperate", "shun", "enchant"], "answerIndex": 2, "translation": "ジャネットが夫を裏切っていたことが明らかになると、共通の友人の多くが彼女を避け始めた。彼らが彼女ではなく夫の味方なのは明らかだった。"},
    {"stem": "A: I'm on the phone with a client, Tina. Can you come back later?\nB: I'm sorry to ( ) like this, but it's an emergency. I have to speak with you right away.", "choices": ["scale down", "own up", "barge in", "knuckle under"], "answerIndex": 2, "translation": "A：ティナ、今顧客と電話中なんだ。後で戻ってきてくれる？\nB：こんなふうに割り込んですみません。でも緊急事態なんです。すぐに話さなければなりません。"},
    {"stem": "A: Wow, this factory is huge!\nB: It has to be huge, as it's expected to ( ) over 100 new cars per day.", "choices": ["puzzle over", "stave off", "coop up", "crank out"], "answerIndex": 3, "translation": "A：わあ、この工場は大きいね！\nB：1日に100台以上の新車を大量生産する見込みだから、大きくなければならないんだ。"},
    {"stem": "Even though Miranda was over three hours late for work, she just ( ) acting like everything was normal. The boss seemed confused at her confident behavior.", "choices": ["squared up", "flared up", "poked around", "breezed in"], "answerIndex": 3, "translation": "ミランダは仕事に3時間以上遅れたのに、何事もなかったかのように平然と入ってきた。上司は彼女の自信満々な態度に困惑した。"},
    {"stem": "Even though it was only two in the afternoon, it was dark outside because the smoke from the forest fire had ( ) the sun.", "choices": ["blotted out", "strung along", "struck up", "waited on"], "answerIndex": 0, "translation": "まだ午後2時だったにもかかわらず、山火事の煙が太陽を完全に覆い隠したため、外は暗かった。"},
]


DETAILS = {
    "pseudonym": ("筆名、偽名", "名詞", "The novelist chose a pseudonym to protect her privacy.", "その小説家はプライバシーを守るため筆名を選んだ。"),
    "pasture": ("牧草地", "名詞", "The horses were grazing in the green pasture.", "馬たちは緑の牧草地で草を食べていた。"),
    "repose": ("休息、静けさ", "名詞", "The quiet garden offered a place of repose.", "その静かな庭は休息の場を提供した。"),
    "precipitation": ("降水、降雨", "名詞", "The region receives very little precipitation in winter.", "その地域では冬の降水量がとても少ない。"),
    "quivered": ("震えた", "動詞", "Her voice quivered as she read the difficult letter.", "彼女は難しい手紙を読むとき声を震わせた。"),
    "plummeted": ("急落した", "動詞", "The temperature plummeted after the sun went down.", "日が沈んだ後、気温が急落した。"),
    "bulged": ("膨らんだ、突き出た", "動詞", "The box bulged with books and papers.", "その箱は本と書類で膨らんでいた。"),
    "balked": ("ためらった、難色を示した", "動詞", "She balked at the high price of the apartment.", "彼女はそのアパートの高い価格に難色を示した。"),
    "professed": ("公言した、称した", "動詞", "He professed his support for the new environmental law.", "彼は新しい環境法への支持を公言した。"),
    "waylaid": ("待ち伏せした", "動詞", "The travelers were waylaid by thieves on the mountain road.", "旅行者たちは山道で盗賊に待ち伏せされた。"),
    "permeated": ("浸透した、行き渡った", "動詞", "The smell of bread permeated the small bakery.", "パンの匂いが小さなパン屋全体に行き渡った。"),
    "detonated": ("爆発させた", "動詞", "The engineers detonated the device in a safe area.", "技術者たちは安全な場所で装置を爆発させた。"),
    "incompetent": ("無能な", "形容詞", "The incompetent manager failed to organize the project.", "その無能な管理者は計画をまとめられなかった。"),
    "imminent": ("差し迫った", "形容詞", "The dark clouds suggested that a storm was imminent.", "暗い雲は嵐が差し迫っていることを示していた。"),
    "optimum": ("最適な", "形容詞", "The machine works best at its optimum temperature.", "その機械は最適な温度で最もよく動く。"),
    "stolid": ("無感動な、鈍感な", "形容詞", "The stolid guard showed no reaction to the loud noise.", "その無感動な警備員は大きな音にも反応を示さなかった。"),
    "maxim": ("格言、金言", "名詞", "My grandfather often repeated the maxim that honesty is the best policy.", "祖父は正直が最善の策だという格言をよく繰り返した。"),
    "synthesis": ("統合、総合", "名詞", "The report is a synthesis of data from several studies.", "その報告書は複数の研究のデータを総合したものだ。"),
    "strife": ("争い、対立", "名詞", "Years of political strife weakened the country.", "何年にもわたる政治的対立が国を弱体化させた。"),
    "liability": ("負債、責任、厄介なもの", "名詞", "The damaged vehicle became a liability for the small company.", "損傷した車両はその小さな会社にとって負担になった。"),
    "encrypts": ("暗号化する", "動詞", "The application encrypts all messages before sending them.", "そのアプリケーションはすべてのメッセージを送信前に暗号化する。"),
    "affixes": ("貼り付ける、付加する", "動詞", "The clerk affixes a label to each package.", "事務員は各荷物にラベルを貼り付ける。"),
    "decrees": ("布告する、命令する", "動詞", "The king decrees that all citizens must pay the new tax.", "王はすべての市民が新しい税を払わなければならないと布告する。"),
    "proscribes": ("禁止する", "動詞", "The law proscribes the sale of alcohol to minors.", "その法律は未成年者への酒の販売を禁止している。"),
    "cranky": ("不機嫌な、気難しい", "形容詞", "The child became cranky after missing his afternoon nap.", "その子どもは昼寝をし損ねて不機嫌になった。"),
    "painstaking": ("綿密な、骨の折れる", "形容詞", "The historian made a painstaking study of the old documents.", "その歴史家は古文書を綿密に調査した。"),
    "superfluous": ("余分な、不要な", "形容詞", "The editor removed several superfluous sentences from the article.", "編集者は記事からいくつかの不要な文を削除した。"),
    "cohesive": ("結束した", "形容詞", "The workshop helped the volunteers become a cohesive team.", "その研修によってボランティアたちは結束したチームになった。"),
    "delusions": ("妄想、思い込み", "名詞", "The patient suffered from delusions about being watched.", "その患者は監視されているという妄想に苦しんでいた。"),
    "gripes": ("不満、愚痴", "名詞", "The workers shared their gripes during the meeting.", "労働者たちは会議で不満を口にした。"),
    "perks": ("特典、福利厚生", "名詞", "Flexible hours are one of the best perks of the job.", "柔軟な勤務時間はその仕事の最もよい特典の一つだ。"),
    "hitches": ("障害、支障", "名詞", "The project went ahead without any major hitches.", "その計画は大きな支障なく進んだ。"),
    "diced": ("さいの目に切った", "動詞", "She diced the carrots before adding them to the soup.", "彼女はスープに加える前にニンジンをさいの目に切った。"),
    "fazed": ("動じさせた", "動詞", "The difficult question did not faze the experienced lawyer.", "その難しい質問も経験豊富な弁護士を動じさせなかった。"),
    "clinched": ("勝ち取った、確定した", "動詞", "The final goal clinched the team's place in the tournament.", "最後の得点で、そのチームの大会出場が確定した。"),
    "condensed": ("凝縮した、短縮した", "動詞", "The teacher condensed the long lecture into a short handout.", "教師は長い講義を短いプリントにまとめた。"),
    "definitive": ("決定的な、最終的な", "形容詞", "The study provides definitive evidence of the effect.", "その研究はその効果について決定的な証拠を示している。"),
    "cavalier": ("軽率な、無頓着な", "形容詞", "He was cavalier about the money he had borrowed.", "彼は借りたお金を軽率に扱っていた。"),
    "fiendish": ("極悪な、非常に難しい", "形容詞", "The puzzle contained a fiendish combination of clues.", "そのパズルには非常に難しい手がかりの組み合わせが含まれていた。"),
    "retentive": ("記憶力のよい、保持力のある", "形容詞", "She has a retentive memory for names and dates.", "彼女は名前や日付をよく覚えている。"),
    "teetering": ("危うく揺れている", "動詞", "The old tower was teetering on the edge of collapse.", "その古い塔は崩壊の瀬戸際で危うく揺れていた。"),
    "twitching": ("ぴくぴく動く", "動詞", "His tired eyelid kept twitching during the meeting.", "会議中、彼の疲れたまぶたはぴくぴく動き続けた。"),
    "matriculating": ("入学手続きをする", "動詞", "She is matriculating at the university this spring.", "彼女はこの春、その大学に入学手続きをしている。"),
    "sheering": ("刈り取る、切り落とす", "動詞", "The farmer is sheering the sheep before summer.", "農家は夏になる前に羊の毛を刈っている。"),
    "insignia": ("記章、徽章", "名詞", "The officer wore the unit's insignia on his uniform.", "その士官は制服に部隊の記章を付けていた。"),
    "indictment": ("起訴、非難", "名詞", "The indictment accused the company of hiding important data.", "起訴状はその会社が重要なデータを隠したと非難していた。"),
    "impasse": ("行き詰まり", "名詞", "The negotiations reached an impasse over the price.", "価格をめぐって交渉は行き詰まった。"),
    "auspice": ("後援、吉兆", "名詞", "The festival was held under the auspice of the city council.", "その祭りは市議会の後援のもとで開催された。"),
    "banish": ("追放する", "動詞", "The ruler banished the traitor from the kingdom.", "支配者は裏切り者を王国から追放した。"),
    "procure": ("調達する", "動詞", "The hospital procured extra supplies before the storm.", "病院は嵐の前に追加の物資を調達した。"),
    "stump": ("困らせる、困惑させる", "動詞", "The unexpected question stumped the spokesperson.", "予想外の質問が広報担当者を困らせた。"),
    "infuse": ("吹き込む、注入する", "動詞", "The coach tried to infuse the players with confidence.", "コーチは選手たちに自信を吹き込もうとした。"),
    "prudent": ("慎重な、用心深い", "形容詞", "It would be prudent to save some money for emergencies.", "緊急時のためにお金をいくらか貯めておくのが賢明だ。"),
    "mutinous": ("反抗的な、反乱の", "形容詞", "The mutinous sailors refused to follow the captain's orders.", "反抗的な船員たちは船長の命令に従うのを拒んだ。"),
    "delectable": ("とてもおいしい", "形容詞", "The restaurant is famous for its delectable desserts.", "そのレストランはとてもおいしいデザートで有名だ。"),
    "unrelenting": ("容赦ない、絶え間ない", "形容詞", "The unrelenting rain caused the river to overflow.", "絶え間ない雨で川が氾濫した。"),
    "gait": ("歩き方、足取り", "名詞", "The doctor noticed a change in the patient's gait.", "医師は患者の歩き方の変化に気づいた。"),
    "feud": ("確執、長期の争い", "名詞", "The two families ended their long feud.", "その二つの家族は長年の確執を終わらせた。"),
    "whim": ("気まぐれ", "名詞", "He bought the painting on a whim.", "彼は気まぐれでその絵を買った。"),
    "rig": ("不正に操作する、装置", "動詞", "The investigators found that the election had been rigged.", "捜査員たちは選挙が不正に操作されていたことを発見した。"),
    "wayward": ("気まぐれな、手に負えない", "形容詞", "The teacher tried to guide the wayward student.", "教師は手に負えない生徒を導こうとした。"),
    "inconspicuous": ("目立たない", "形容詞", "The small sign was inconspicuous among the larger advertisements.", "その小さな看板は大きな広告の中で目立たなかった。"),
    "spellbound": ("魅了された", "形容詞", "The children sat spellbound during the magician's performance.", "子どもたちは手品師の演技に魅了されて座っていた。"),
    "intrepid": ("勇敢な、恐れを知らない", "形容詞", "The intrepid climber reached the summit in winter.", "その勇敢な登山家は冬に頂上へ到達した。"),
    "blister": ("水ぶくれ", "名詞", "A painful blister formed on his heel after the hike.", "ハイキングの後、彼のかかとに痛い水ぶくれができた。"),
    "footage": ("映像、写真フィルム", "名詞", "The station broadcast footage of the flooding.", "その放送局は洪水の映像を放送した。"),
    "moratorium": ("一時停止、停止期間", "名詞", "The government announced a moratorium on new mining permits.", "政府は新しい採掘許可の一時停止を発表した。"),
    "snare": ("わな、罠にかけるもの", "名詞", "The animal was caught in a wire snare.", "その動物は針金のわなにかかった。"),
    "reveled": ("大いに楽しんだ", "動詞", "The fans reveled in their team's unexpected victory.", "ファンたちはチームの予想外の勝利を大いに喜んだ。"),
    "bellowed": ("怒鳴った", "動詞", "The coach bellowed instructions from the sidelines.", "コーチはサイドラインから指示を怒鳴った。"),
    "cantered": ("馬が軽速歩した", "動詞", "The horse cantered along the beach at sunset.", "馬は夕暮れの浜辺を軽速歩で進んだ。"),
    "trickled": ("少しずつ流れた", "動詞", "A few customers trickled into the store after lunch.", "昼食後、数人の客が少しずつ店に入ってきた。"),
    "anesthetic": ("麻酔薬", "名詞", "The dentist applied a local anesthetic before the procedure.", "歯科医は処置の前に局所麻酔薬を使った。"),
    "specter": ("幽霊、不安の影", "名詞", "The specter of unemployment worried many families.", "失業の影が多くの家庭を不安にさせた。"),
    "ordinance": ("条例、法令", "名詞", "The city passed an ordinance limiting noise at night.", "市は夜間の騒音を制限する条例を可決した。"),
    "proponent": ("支持者、提唱者", "名詞", "She is a strong proponent of renewable energy.", "彼女は再生可能エネルギーの強い支持者だ。"),
    "precocious": ("早熟な", "形容詞", "The precocious child could read before entering school.", "その早熟な子どもは入学前に読むことができた。"),
    "capricious": ("気まぐれな", "形容詞", "The capricious weather changed from sun to rain within minutes.", "気まぐれな天気は数分で晴れから雨に変わった。"),
    "scrupulous": ("良心的な、入念な", "形容詞", "The scrupulous accountant checked every figure twice.", "その入念な会計士はすべての数字を2度確認した。"),
    "treacherous": ("危険な、裏切りやすい", "形容詞", "The climbers faced treacherous ice near the summit.", "登山者たちは頂上付近で危険な氷に直面した。"),
    "nurture": ("育てる、養う", "動詞", "Good teachers nurture curiosity in their students.", "よい教師は生徒の好奇心を育てる。"),
    "exasperate": ("いらだたせる", "動詞", "The constant delays exasperated the passengers.", "度重なる遅れが乗客たちをいらだたせた。"),
    "shun": ("避ける、遠ざける", "動詞", "The community chose to shun the dishonest trader.", "その地域社会は不正直な商人を避けることにした。"),
    "enchant": ("魅了する", "動詞", "The old castle enchanted visitors with its mysterious atmosphere.", "その古城は神秘的な雰囲気で訪問者を魅了した。"),
    "scale down": ("縮小する", "熟語", "The company had to scale down the project because of budget cuts.", "その会社は予算削減のため計画を縮小しなければならなかった。"),
    "own up": ("白状する、認める", "熟語", "He finally owned up to breaking the window.", "彼はついに窓を割ったことを白状した。"),
    "barge in": ("押しかける、割り込む", "熟語", "Please knock before you barge in on a meeting.", "会議に割り込む前にノックしてください。"),
    "knuckle under": ("屈服する、従う", "熟語", "The company eventually knuckled under to public pressure.", "その会社は最終的に世論の圧力に屈した。"),
    "puzzle over": ("頭を悩ませる", "熟語", "The scientists puzzled over the strange results.", "科学者たちは奇妙な結果に頭を悩ませた。"),
    "stave off": ("食い止める、避ける", "熟語", "The medicine helped stave off a serious infection.", "その薬は深刻な感染症を食い止めるのに役立った。"),
    "coop up": ("閉じ込める", "熟語", "The storm cooped us up indoors all weekend.", "嵐のため私たちは週末ずっと屋内に閉じ込められた。"),
    "crank out": ("大量に作る", "熟語", "The factory cranks out hundreds of chairs every day.", "その工場は毎日何百脚もの椅子を大量生産している。"),
    "squared up": ("勘定を清算した、対峙した", "熟語", "We squared up the bill before leaving the restaurant.", "私たちはレストランを出る前に勘定を清算した。"),
    "flared up": ("突然悪化した、燃え上がった", "熟語", "The argument flared up again during the meeting.", "会議中にその口論が再び激しくなった。"),
    "poked around": ("あちこち探った", "熟語", "The reporter poked around for evidence in the old warehouse.", "記者は古い倉庫で証拠を求めてあちこち調べた。"),
    "breezed in": ("軽々と入ってきた", "熟語", "She breezed in late and acted as if nothing had happened.", "彼女は遅れて軽々と入ってきて、何も起きなかったかのように振る舞った。"),
    "blotted out": ("完全に覆い隠した", "熟語", "Thick clouds blotted out the moon.", "厚い雲が月を完全に覆い隠した。"),
    "strung along": ("だました、引き延ばした", "熟語", "The seller strung us along for weeks without delivering the order.", "その販売者は注文を届けないまま何週間も私たちを引き延ばした。"),
    "struck up": ("始めた、築いた", "熟語", "The travelers struck up a conversation on the train.", "旅行者たちは列車の中で会話を始めた。"),
    "waited on": ("給仕した、対応した", "熟語", "A friendly server waited on us throughout the meal.", "親切な店員が食事中ずっと私たちに給仕した。"),
}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build() -> tuple[dict, dict]:
    if len(QUESTIONS) != 25:
        raise ValueError("模試 第5回は25問である必要があります")
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
        "source": "ユーザー提供の模試原稿（模試 第5回）を学習用JSONへ構造化",
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
    write_json(DATA_DIR / "vocab_1_mock-5.json", vocab)
    write_json(DATA_DIR / "questions_1_mock-5.json", questions)
    print("mock-5: 25 questions / 100 items (84 words, 16 idioms)")


if __name__ == "__main__":
    main()
