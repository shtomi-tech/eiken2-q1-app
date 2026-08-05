"""英検1級の大問1を、既存の共通Q1形式へ抽出する。

公式PDFは data/eiken_1/ 以下に置く。ここは .gitignore 対象で、公開側には
大問1用に変換したJSONだけを渡す。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from build_pre1_data import (  # noqa: E402 - 既存PDF抽出ヘルパーを再利用する
    answer_key,
    clean_text,
    page_texts,
    parse_choices,
    parse_numbered_blocks,
)


ROOT = SCRIPTS_DIR.parent
DATA_DIR = ROOT / "data"
SOURCE_ROOT = DATA_DIR / "eiken_1"
ROUND_IDS = ("2026-1", "2025-3", "2025-2")

SOURCE_URLS = {
    "2026-1": {
        "problem": "https://www.eiken.or.jp/eiken/exam/kakomon/2026-1-1ji-1kyu.pdf",
        "answer": "https://www.eiken.or.jp/eiken/result/pdf/202601F1kyu.pdf",
    },
    "2025-3": {
        "problem": "https://www.eiken.or.jp/eiken/exam/kakomon/2025-3-1ji-1kyu.pdf",
        "answer": "https://www.eiken.or.jp/eiken/result/pdf/202503F1kyu.pdf",
    },
    "2025-2": {
        "problem": "https://www.eiken.or.jp/eiken/exam/kakomon/2025-2-1ji-1kyu.pdf",
        "answer": "https://www.eiken.or.jp/eiken/result/pdf/202502F1kyu.pdf",
    },
}


# 公式問題の選択肢に対応する学習用の簡潔な日本語 gloss。
# 問題冊子には訳語がないため、辞書的な代表義を採用している。
MEANINGS = dict(
    line.split("|", 1)
    for line in """
acclaim|称賛、賞賛
acclimated|慣れた、順応した
ailing|病気の、弱っている
alacrity|快活さ、敏捷さ
alleviated|軽減した、和らげた
ambivalent|相反する感情を抱く、どちらとも決めかねる
anonymous|匿名の、無名の
appeased|なだめた、満足させた
appraised|評価された、査定された
ascetic|禁欲的な
assassination|暗殺；人格攻撃、中傷
auspicious|幸先のよい、縁起のよい
averted|避けた、回避した
backlog|未処理の仕事の山、滞留
belittle|軽視する、けなす
bemoan|嘆く、こぼす
bigotry|偏見、偏狭さ
black out|意識を失う；停電する
boisterous|騒々しい、活発な
bolster|強化する、支える
branch off|分岐する、枝分かれする
branch out|新分野に進出する
bravado|虚勢、強がり
breeze in|ふらりと入ってくる
brusquely|ぶっきらぼうに、ぞんざいに
buckle down|本腰を入れて取り組む
build in|組み込む
bungled|へまをした、しくじった
buskers|路上演奏者
buttress|支える、強化する
buttressing|支持、強化
cajole|甘言で説得する、なだめすかす
cast down|落胆させる、意気消沈させる
caustic|辛辣な、痛烈な
censure|非難、譴責
cessation|停止、中止
choke off|抑え込む、遮断する
churn out|大量に作り出す
clam up|口をつぐむ
clatter|ガチャガチャという音
clemency|慈悲、寛大な処置
coaxed|うまく説得した
collate|照合する、比較する
conciliated|和解させた、懐柔した
concocted|でっち上げた、調合した
congeniality|親しみやすさ、気の合う性質
consignment|委託品、発送品
consolidated|統合した、固めた
contempt|軽蔑、侮辱
contiguous|隣接した、連続した
contorted|ねじ曲げた、ゆがめた
contrite|深く後悔した、悔恨の
convergence|収束、融合
cordially|心から、丁重に
coup|クーデター；大成功
crack down|厳しく取り締まる
crank out|次々と作り出す
credence|信用、信憑性
crop up|不意に起こる
dearth|不足、欠乏
deduced|推論して導き出した
defer|延期する
deferentially|目上の人に敬意を払って
deified|神格化した
demeanor|態度、物腰
digression|脱線、余談
dilapidated|荒廃した、ぼろぼろの
diminutive|小さい、小柄な
discord|不和、意見の不一致
discreetly|慎重に、目立たないように
discretion|慎重さ、分別
disheveled|乱れた、だらしのない
dissipate|消散させる、浪費する
ditch|溝、どぶ；捨てる
dive in|飛び込む、すぐ取りかかる
dogma|独断的な教義、定説
dole out|少しずつ配る
drone on|だらだら話し続ける
dubious|疑わしい
duped|だまされた
dwell on|くよくよ考える、詳しく論じる
ease off|弱まる、手加減する
eccentric|風変わりな
elucidate|明らかにする、解明する
emanated|発した、発生した
embezzlement|横領
enervating|精力を奪う
enigma|謎
enraptured|有頂天になった、夢中になった
entailed|伴った、必要とした
entreaty|懇願
envoys|使節
equivocated|言葉を濁した、曖昧に答えた
expounded|詳しく説明した
extolled|大いに褒めた
extraterrestrial|地球外の、宇宙人
exuberant|熱狂的な、あふれんばかりの
farm out|外注する
fastidious|細かいことにうるさい、念入りな
fermented|発酵させた
flouted|公然と無視した、軽視した
fortitude|不屈の精神
fortuitous|偶然の、思いがけない
foul up|めちゃくちゃにする、失敗する
fritter away|浪費する
futility|無益、むなしさ
gaunt|やせこけた、やつれた
germination|発芽
get behind|遅れをとる；支持する
gist|要点、大意
glaze|釉薬、光沢
grafted|接ぎ木した、移植した
gratify|満足させる
grievance|不満、苦情
grime|汚れ、すす
grow on|次第に好きになる、徐々に影響する
haphazard|無計画な、でたらめな
haul off|急に持ち去る、引きずっていく
heedless|不注意な、気に留めない
heresy|異端、異端説
hindsight|後知恵
hush up|もみ消す、黙らせる
identify with|共感する、～と自分を重ねる
impasse|行き詰まり
implored|懇願した
impregnable|攻略不能な、難攻不落の
impromptu|即興の、準備なしの
inane|ばかげた、無意味な
incarcerated|投獄された
incisive|鋭い、的確な
incumbent|現職者
incursion|侵入、襲撃
inherent|固有の、本来備わった
intangible|無形の、触れられない
intrepid|勇敢な、恐れを知らない
invigorated|元気づけられた、活気づいた
jarring|耳障りな、調和を乱す
jeopardy|危険
jilted|捨てられた、婚約破棄された
lackluster|ぱっとしない、精彩を欠く
lament|嘆く、悲しむ
lanky|ひょろ長い
levity|軽薄さ、軽口
liaison|連絡、連携；密通
loot|戦利品、略奪品
lop off|切り落とす
lucrative|もうかる
lustrous|光沢のある、輝く
magnanimous|寛大な
malevolent|悪意のある
meager|わずかな、乏しい
mete out|（罰などを）与える
mulled|熟考した
mutinous|反乱の、反抗的な
mutter|ぶつぶつ言う
nebulous|曖昧模糊とした
niche|隙間市場、適所
nod off|うとうとする
nostalgia|郷愁、懐かしさ
notoriety|悪名
obliterated|完全に破壊された、消し去られた
omen|前兆
ornate|装飾過多の
outreach|働きかけ、支援活動
overt|公然の、明白な
own up|白状する、認める
pampered|甘やかされた
pan out|うまくいく、結果が出る
paramount|最高の、最重要の
patch up|（関係などを）修復する
pawn|質に入れる
peddled|売り歩いた、広めた
peek|のぞき見る
percolate|浸透する、ろ過する
percolated|しみ通った、浸透した
perennial|長年続く、恒久的な
pertinent|関係のある、適切な
pilgrim|巡礼者
pipe down|黙る、静かにする
placated|なだめた
plantations|大農園
ploddingly|のろのろと
pluck up|勇気を奮い起こす
plug in|差し込む、接続する
polish off|片付ける、素早く終える
pony up|（金を）支払う
porous|多孔性の、穴の多い
posterity|後世の人々
precocious|早熟な
prevarication|言い逃れ、曖昧な答え
pristine|汚れのない、原始のままの
proclaimed|宣言した、公言した
provincial|地方の；視野の狭い
provisions|食料、備蓄
pungent|強烈な（味・臭い）；辛辣な
purged|除去した、一掃した
quarantine|隔離
queasy|吐き気がする
quenched|消した、癒やした
query|質問、疑問
redeem|償う、買い戻す
reel in|引き寄せる、だます
reel off|次々にすらすら言う
repulsed|反感を抱かせた、退けた
rescinded|取り消した
reverted|元に戻った
revoke|取り消す、撤回する
ridge|尾根、隆起部
rife|はびこった、満ちた
rip off|だまし取る、ぼったくる
rotund|丸々とした、太った
rustle up|（食事などを）急いで用意する
saturation|飽和、過密
scamper|走り回る、ちょこちょこ走る
scampered|走り去った
scrawl|乱雑に書く、走り書き
scruffy|だらしない、薄汚れた
sentiment|感情、意見
sequentially|順番に
sit by|傍観する
slanted|傾いた、偏った
slenderly|細長く、ほっそりと
sockets|ソケット、受け口
solicit|求める、懇願する
solvency|支払い能力
sound off|偉そうに話す、意見をぶちまける
spar|つばぜり合いをする、軽く争う
spurious|偽の、根拠のない
squeamish|神経質で嫌がる、潔癖な
staunch|忠実な、断固とした
stolid|無感動な、冷静な
stooge|手先、道化役
strike back|反撃する
suave|洗練された、物腰の柔らかな
subversive|体制転覆を企てる、破壊的な
sully|汚す、傷つける
superficial|表面的な
surreptitiously|こっそりと
synthesized|合成した、統合した
tacit|暗黙の
tail off|次第に弱まる
tamper with|いじくり回す、改ざんする
tarnished|変色した、傷ついた
tedious|退屈な
tempest|暴風雨、激動
tenuous|希薄な、かすかな
tenure|在職期間、任期
thwart|妨げる
ticklish|くすぐったい；扱いの難しい
translucent|半透明の
torments|苦しみ、苦痛
trump up|でっち上げる
turn up|現れる；音量を上げる
unassuming|控えめな、気取らない
unruly|手に負えない、乱暴な
upheaval|大変動、混乱
ventures|冒険；事業
vertical|垂直の
vestiges|名残、痕跡
virile|男らしい、精力旺盛な
vivacious|生き生きした
ward|病棟；保護する対象
wrest|奪い取る
""".strip().splitlines()
)


TRANSLATIONS = {
    ("2026-1", 1): "市長は税制計画について尋ねられると言葉を濁した。そのため、実際の政策が誰にも分からなかった。",
    ("2026-1", 2): "将軍は軍の防衛を強化するため、国境へさらに兵を送ることにした。力を示せば攻撃を防げると考えた。",
    ("2026-1", 3): "長い議論の後も理事会は合意に達しなかった。そこで、決定を次回の会議まで延期することになった。",
    ("2026-1", 4): "歴史を通じて、貿易交渉や関係改善のために他国へ使節を送ることは常に重要だった。",
    ("2026-1", 5): "選挙戦の現職者であるダベンポート市長は、政治職を務めたことのない対立候補より大きな有利さを持っている。",
    ("2026-1", 6): "英語試験の朝、ラファエルが起きたときは雨だったが、すぐに晴れた。彼は幸先のよい一日の始まりだと考えた。",
    ("2026-1", 7): "兄のおもちゃを取り上げたことで罰を受けると言われると、その少女は深く反省した。謝り、二度としないと約束した。",
    ("2026-1", 8): "戦争中に非常に多くの爆弾が落とされ、街のほぼ半分が完全に破壊された。多数の建物の再建には何年もかかった。",
    ("2026-1", 9): "その女性は市長を断固として支持し、市長をめぐる不祥事にもかかわらず投票し続けた。",
    ("2026-1", 10): "ペドロの英語の聞き取り能力は高くないが、ゆっくり話してもらえば、会話の大意はたいてい分かる。",
    ("2026-1", 11): "世界中の民主主義国がその国との貿易を拒否したため、その国では医薬品などの必需品が不足していた。",
    ("2026-1", 12): "スティーブは翻訳の仕事が簡単だと思っていたが、実際には事実確認など、時間のかかる作業を大量に伴っていた。",
    ("2026-1", 13): "市内で異なる文化が融合しているため、さまざまな文化行事やレストランがあり、住むのに魅力的な場所になっている。",
    ("2026-1", 14): "息子に野菜を食べさせられたか。デザートをあげると約束して、うまく説得した。",
    ("2026-1", 15): "パーティーがあまりに騒々しくなったので、近所の人が騒音について警察に苦情を言った。",
    ("2026-1", 16): "市の長年の問題である交通渋滞は、ここ数か月で悪化している。市長は解決策を見つけるよう迫られている。",
    ("2026-1", 17): "大統領は、非暴力犯罪を犯した囚人たちに恩赦を与えた。彼らには再出発の機会があるべきだと考えたのだ。",
    ("2026-1", 18): "サッカーの試合の観客が手に負えない状態になり始めたので、警察が呼ばれ、乱暴なファンを落ち着かせた。",
    ("2026-1", 19): "その少年は小説の登場人物の誰にも感情移入できず、読書を楽しむのが難しかった。",
    ("2026-1", 20): "その作家は本を次々と書き上げる能力で知られている。1年に3冊も出版することがある。",
    ("2026-1", 21): "整備士は車の所有者に、エンジンをいじくり回さないよう警告した。知識のない人が修理しようとすると、かえって損害を増やすことが多いという。",
    ("2026-1", 22): "メアリーは緊張していたが、勇気を奮い起こして上司に昇給を頼むことにした。",
    ("2025-3", 1): "4年前にあれほど多くの新職員を採用したのが最大の間違いだった。後知恵ではそう言えるが、当時は人員を増やすことが重要に思えた。",
    ("2025-3", 2): "ジャシンダは年会費を払わなかったため、ゴルフクラブの会員資格を取り消された。",
    ("2025-3", 3): "大企業と競争するのは難しかったが、市場の隙間を見つけた。今では他社が提供していないサービスを提供している。",
    ("2025-3", 4): "スザンヌは日本に到着したとき高熱があり、危険なウイルスを持っていないと当局が確認するまで空港で隔離された。",
    ("2025-3", 5): "軍隊は日没直後に敵の領土へ越境した。その侵入は非常に速く、守備側は数時間で圧倒された。",
    ("2025-3", 6): "多くの一流評論家が熱烈に称賛したにもかかわらず、その映画は一般観客には不評だった。",
    ("2025-3", 7): "極端な暑さと湿気のため、ハイカーたちはジャングルをのろのろと進んだ。最後には歩き続けるのもやっとだった。",
    ("2025-3", 8): "消防士は救助要請に応じる際、日常的に命を危険にさらしている。けがや死亡の危険をいつも負っている。",
    ("2025-3", 9): "迷子になった3人のハイカーは、山で救助されたとき極度に空腹だった。2日前に食料が尽き、それ以来何も食べていなかった。",
    ("2025-3", 10): "グレッチェンは祖母のネックレスを宝石商に持っていき、価値を査定してもらった。3000ドル以上の価値があると知って驚いた。",
    ("2025-3", 11): "少年の両親は、怖がっていた彼を最初はジェットコースターに乗るよう説得しなければならなかった。最初の乗車後、彼は何度も乗りたがった。",
    ("2025-3", 12): "ボールドウィン教授は、学生の一人のばかげた発言にすぐ飽きた。その発言のせいで授業の真剣な雰囲気を保てなかった。",
    ("2025-3", 13): "その政治家は党の指導者から主導権を奪おうとしたが失敗し、辞任を余儀なくされた。",
    ("2025-3", 14): "理事会が次の会議で反対意見を何も言わなかったことから、CEOの計画を暗黙に承認していたことが明らかになった。",
    ("2025-3", 15): "建築家は垂直の線を重視し、長く細い窓を使って建物を高く細身に見せた。",
    ("2025-3", 16): "この家は荒廃しているように見える。そう、非常に悪い状態だ。何年も空き家になっている。",
    ("2025-3", 17): "映画評論家の辛辣な発言は監督を怒らせた。監督は演技と脚本への厳しい批評が不公平だと感じた。",
    ("2025-3", 18): "その政治家の社会問題についての発言は、多くの有権者に反感を抱かせた。彼は今、彼らの悪い印象を変えようと懸命に働いている。",
    ("2025-3", 19): "その男性はとても疲れていたので、眠らないよう努力したにもかかわらず、会議中にうとうとせずにはいられなかった。",
    ("2025-3", 20): "その男性は自分の犯罪を認めようとしなかった。警察が犯行中の映像を見せても、否定し続けた。",
    ("2025-3", 21): "多くの日本企業は、部品製造の仕事を自社で行わず、小規模な家族経営の工場に外注している。仕事を分散すると生産が効率化する。",
    ("2025-3", 22): "ジェレミーの両親は、プロ野球選手になる夢が実現しなかった場合に備え、他の職業も探すよう勧めた。",
    ("2025-2", 1): "会社の会計担当者は、5年間で会社から約100万ドルを盗んだことが発覚し、横領で逮捕された。",
    ("2025-2", 2): "その映画は優れた物語と映像美で大きな称賛を受け、すでに主要な賞を2つ獲得している。",
    ("2025-2", 3): "政府が汚職にまみれていることは広く知られていた。役人が最も簡単なサービスを行う前にも金を要求するのが普通だった。",
    ("2025-2", 4): "運動後は疲れると思うかもしれないが、適度な運動の後は実際には元気になったと感じる人が多い。",
    ("2025-2", 5): "レイラニは現在の経済状況を嘆いても無駄だと思い、愚痴を言う代わりに、もっと給料の高い仕事を探すことにした。",
    ("2025-2", 6): "2人の作業員が仕事中にけがをした後、工場では安全が最重要になった。最新の安全基準を満たすため多額の費用が使われた。",
    ("2025-2", 7): "ジャッキーの両親は学校を辞めないよう彼女に懇願したが、彼女は聞かず、ヨガ講師として働き始めた。",
    ("2025-2", 8): "王者を恐れていたが、そのボクサーは記者会見で第1ラウンドに相手を倒すと言い、強がってみせた。",
    ("2025-2", 9): "銀行のハイテク金庫は、侵入して顧客の貴重品を盗むことができないと考えられている。",
    ("2025-2", 10): "宇宙飛行士は宇宙探査のため勇敢に命をかける。その勇敢な人々への報酬は、他にない景色である。",
    ("2025-2", 11): "10年近く投獄されていたため、ブライアンは刑務所の外の生活に慣れるのが難しかった。",
    ("2025-2", 12): "両国の関係は不和の状態にあり、どちらの側も解決策を話し合うために席に着こうとしない。",
    ("2025-2", 13): "その政治家は記者に賄賂を渡そうとしているところを、目立たないように撮影されていた。",
    ("2025-2", 14): "注文した道具の一式は届いたか。まだだが、仕入れ先は週内に届くはずだと言っている。",
    ("2025-2", 15): "候補者の選挙運動は、対立候補が広めたうわさや嘘による人格攻撃で弱体化した。",
    ("2025-2", 16): "そのジャーナリストは根拠がほとんどない主張をする、根拠のない記事を発表したため解雇された。",
    ("2025-2", 17): "そんなにひどい車を買うようだまされたなんて信じられない。まったくお金の無駄だった。",
    ("2025-2", 18): "その男性は仕事を失うと、家賃を払うためのお金を何とか作る最後の手段として、時計を質に入れるしかなかった。",
    ("2025-2", 19): "期末試験まであと1か月なので、今こそ本腰を入れて一生懸命勉強するときだ。学校が終われば休む時間はたくさんある。",
    ("2025-2", 20): "飲酒運転の増加を受け、警察は厳しい取り締まりを始めた。道路封鎖を行い、無作為の呼気検査をしている。",
    ("2025-2", 21): "別の町に住む友人が突然来たので、リックは急いで食べ物と飲み物を用意しなければならなかった。幸い冷蔵庫に軽食とソーダがあった。",
    ("2025-2", 22): "予期しない問題が起きたときは、落ち着いて論理的に解決方法を考えることが重要だ。",
}


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_choice(value: str) -> str:
    # ページ末尾の案内文が、最後の選択肢の抽出範囲に入ることがある。
    value = re.split(r"To complete each item|Read each passage", value, maxsplit=1)[0]
    return clean_text(value)


def extract_questions(round_id: str) -> list[dict]:
    source = SOURCE_ROOT / round_id
    pages = page_texts(source / "problem.pdf")
    answers = answer_key(source / "answer.pdf")
    blocks: list[tuple[int, str]] = []
    for page_index in (2, 3, 4):
        blocks.extend(parse_numbered_blocks(pages[page_index]))

    questions = []
    for number, block in blocks:
        if number > 22:
            continue
        stem, raw_choices = parse_choices(block)
        choices = [clean_choice(choice) for choice in raw_choices]
        if len(choices) != 4 or any(not choice for choice in choices):
            raise ValueError(f"{round_id}: Q{number}の選択肢を抽出できません")
        if number not in answers:
            raise ValueError(f"{round_id}: Q{number}の正答がありません")
        questions.append(
            {
                "q": number,
                "stem": stem or f"空所（{number}）に入る語句を選んでください。",
                "choices": choices,
                "answerIndex": answers[number],
                "translation": TRANSLATIONS.get((round_id, number), ""),
            }
        )

    if [question["q"] for question in questions] != list(range(1, 23)):
        raise ValueError(f"{round_id}: 1級大問1の設問番号が不連続です")
    return questions


def build_round(round_id: str) -> tuple[dict, dict]:
    questions = extract_questions(round_id)
    surfaces = {choice for question in questions for choice in question["choices"]}
    missing = sorted(surfaces - set(MEANINGS))
    if missing:
        raise ValueError(f"{round_id}: gloss未登録: {missing}")

    words = []
    idioms = []
    for question in questions:
        for index, choice in enumerate(question["choices"]):
            item = {
                "q": question["q"],
                "is_answer": index == question["answerIndex"],
                "meaning": MEANINGS[choice],
            }
            if " " in choice:
                item["phrase"] = choice
                item["pos"] = "熟語"
                idioms.append(item)
            else:
                item["word"] = choice
                words.append(item)

    meta = {
        "grade": "英検1級",
        "round": round_id,
        "section": "Reading 大問1（語句空所補充）",
        "source": "英検公式の過去問PDFを、許諾のもと大問1だけ学習用JSONへ構造化",
        "source_problem_url": SOURCE_URLS[round_id]["problem"],
        "source_answer_url": SOURCE_URLS[round_id]["answer"],
        "counts": {"words": len(words), "idioms": len(idioms), "total": len(words) + len(idioms)},
    }
    return (
        {"meta": meta, "words": words, "idioms": idioms},
        {"meta": meta, "questions": questions},
    )


def main() -> None:
    for round_id in ROUND_IDS:
        vocab, questions = build_round(round_id)
        write_json(DATA_DIR / f"vocab_1_{round_id}.json", vocab)
        write_json(DATA_DIR / f"questions_1_{round_id}.json", questions)
        print(f"{round_id}: 22 questions / {vocab['meta']['counts']['total']} items")


if __name__ == "__main__":
    main()
