"""Vocabulary flashcard content for the Eiken Pre-1 大問1 mode.

Each round maps question number -> list of 4 entries, in the SAME order as
reading.part1[q-1].choices in data/pre1_{round}.json (choiceIndex-based
linking, so no fragile string matching is needed at runtime).

This content (meaning/etymology/example/collocation) was newly written by
the agent for this app; it is not an official Eiken publication. Meanings
follow standard dictionary senses for the word as used in the given test
item. Etymologies are simplified, textbook-level accounts (Latin/Greek/Old
English roots); entries where the etymology is genuinely uncertain or
disputed are marked with etymology_uncertain=True instead of guessing.
Part-of-speech is the sense used in the test item, not every possible use
of the word.
"""

W = "word"


def e(word, is_answer, pos, meaning, etymology, example, collocation=None, etymology_uncertain=False):
    entry = {
        "word": word,
        "isAnswer": is_answer,
        "pos": pos,
        "meaning": meaning,
        "etymology": etymology,
        "example": example,
    }
    if collocation:
        entry["collocation"] = collocation
    if etymology_uncertain:
        entry["etymologyUncertain"] = True
    return entry


ROUND_2026_1 = {
    1: [
        e("cemetery", False, "名詞", "墓地", "ギリシャ語 koimeterion「眠る場所」がラテン語・古フランス語を経て英語に入った。", "The old cemetery on the hill has graves dating back two centuries."),
        e("diagram", True, "名詞", "図、図表", "ギリシャ語 diagramma。dia-「〜を通して」+ graphein「書く・描く」。", "The teacher drew a diagram on the board to show how blood flows through the heart."),
        e("equation", False, "名詞", "方程式、等式", "ラテン語 aequare「等しくする」(aequus「等しい」)から。", "She solved the equation by isolating x on one side."),
        e("forecast", False, "名詞", "予報、予測", "fore-「前もって」+ cast「投げる、見積もる」の複合語。", "According to the forecast, it will rain all weekend.", collocation="weather forecast"),
    ],
    2: [
        e("possessive", False, "形容詞", "所有欲の強い、独占欲の強い", "ラテン語 possidere「所有する」の派生語 possessivus から。", "He became possessive about his girlfriend and didn't like her spending time with other friends."),
        e("horizontal", False, "形容詞", "水平の", "ギリシャ語 horizon「境界を区切る(円)」+ -al。", "Lay the board horizontal before you start cutting it."),
        e("redundant", True, "形容詞", "余分な、冗長な、不要な", "ラテン語 redundare「あふれ出る」。red-「再び」+ undare「波立つ」(unda「波」)。", "This sentence in your essay is redundant; you already said the same thing in the previous paragraph."),
        e("drastic", False, "形容詞", "徹底的な、思い切った、過激な", "ギリシャ語 drastikos「効果的な、行動的な」(dran「行う」)から。", "The company took drastic measures to cut costs, including laying off a third of its staff."),
    ],
    3: [
        e("haul", False, "動詞", "引っ張る、(重い物を)運ぶ", "「引く」を意味する hale の異形。古フランス語 haler(ゲルマン語起源)経由。", "The fishermen hauled the nets onto the deck."),
        e("envy", False, "動詞", "うらやむ、ねたむ", "ラテン語 invidia(invidere「悪意を持って見る」、in-+videre「見る」)から。", "I envy people who can speak three languages fluently."),
        e("subtract", False, "動詞", "引く、減じる", "ラテン語 subtrahere「下に引く」。sub-「下に」+ trahere「引く」。", "If you subtract 15 from 40, you get 25."),
        e("censor", True, "動詞", "検閲する", "ラテン語 censere「評価する、判定する」。古代ローマの風紀監督官 censor に由来。", "The government censored the film before allowing it to be shown in theaters."),
    ],
    4: [
        e("referral", False, "名詞", "紹介、(専門医への)委託、照会", "refer(ラテン語 referre、re-+ferre「運ぶ」)+ -al。", "My doctor gave me a referral to see a specialist."),
        e("recipient", True, "名詞", "受取人", "ラテン語 recipere「受け取る」(re-+capere「取る」)から。", "She was the recipient of a scholarship for outstanding academic achievement."),
        e("bouncer", False, "名詞", "(クラブなどの)用心棒", "bounce「跳ね返る」+ -er。「用心棒」の意味は20世紀に発達した。", "The bouncer at the club checked everyone's ID before letting them in.", etymology_uncertain=True),
        e("successor", False, "名詞", "後継者", "ラテン語 succedere「後に続く」(sub-+cedere「行く」)の派生語。", "The CEO announced his successor before retiring."),
    ],
    5: [
        e("triggering", False, "動詞(-ing)", "引き起こす(こと)", "trigger はオランダ語 trekker(trekken「引く」)から。", "Loud noises can trigger a panic attack in some people."),
        e("fabricating", True, "動詞(-ing)", "でっち上げる(こと)、捏造する(こと)", "ラテン語 fabricare「作る、組み立てる」(fabrica「工房」)から。", "The witness admitted to fabricating parts of his story."),
        e("conserving", False, "動詞(-ing)", "保存する(こと)、節約する(こと)", "ラテン語 conservare。com-「共に」+ servare「保つ」。", "We're conserving water during the drought by taking shorter showers."),
        e("renouncing", False, "動詞(-ing)", "放棄する(こと)、断念する(こと)", "ラテン語 renuntiare「拒否を宣言する」。re-+nuntiare「知らせる」(nuntius「使者」)。", "He renounced his claim to the family business."),
    ],
    6: [
        e("ransom", False, "名詞", "身代金", "古フランス語 raençon。ラテン語 redemptio「買い戻し」と同語源(redemption と同根)。", "The kidnappers demanded a large ransom for the hostage's release."),
        e("specimen", False, "名詞", "標本、見本", "ラテン語 specimen「印、実例」(specere「見る」)から。", "The biologist collected a specimen of the rare plant for study."),
        e("cavity", False, "名詞", "空洞、虫歯", "ラテン語 cavus「空洞の」+ -ity。", "The dentist found a small cavity in one of my back teeth."),
        e("citation", True, "名詞", "引用、召喚状、表彰", "ラテン語 citare「呼び出す、動かす」(ciere「動かす・呼ぶ」の反復形)から。", "The professor asked students to include a proper citation for every source they used."),
    ],
    7: [
        e("distortion", False, "名詞", "歪み、歪曲", "ラテン語 distorquere「あちこちにねじる」。dis-+torquere「ねじる」。", "The old mirror created a strange distortion of my reflection."),
        e("generosity", False, "名詞", "寛大さ、気前の良さ", "ラテン語 generosus「高貴な、寛大な」(genus「生まれ、家柄」)から。", "Her generosity toward the local charity was widely admired."),
        e("turbulence", True, "名詞", "乱気流、動揺、混乱", "ラテン語 turbulentus「騒然とした」(turba「群衆、騒動」)から。", "The plane shook violently as it passed through an area of turbulence."),
        e("conjecture", False, "名詞", "推測、憶測", "ラテン語 conicere「投げ合わせる、推論する」。com-+iacere「投げる」。", "Without any real evidence, his theory is pure conjecture."),
    ],
    8: [
        e("nutritious", False, "形容詞", "栄養のある", "ラテン語 nutrire「養う」+ -itious。", "A nutritious breakfast helps you concentrate better in the morning."),
        e("diverse", False, "形容詞", "多様な", "ラテン語 diversus「別々の方向を向いた」(divertere の過去分詞)から。", "The city has a diverse population, with residents from over sixty countries."),
        e("barren", True, "形容詞", "不毛の、実を結ばない", "古フランス語 braine/baraigne。語源は未詳(ケルト語起源の可能性)。", "Almost nothing grows in this barren stretch of desert.", etymology_uncertain=True),
        e("coincidental", False, "形容詞", "偶然の、たまたま一致した", "coincide(ラテン語 co-+incidere「たまたま起こる」)+ -al。", "It was purely coincidental that we were staying at the same hotel."),
    ],
    9: [
        e("slack", True, "形容詞", "たるんだ、緩い、(商売などが)不振の", "古英語 slæc「緩い、怠惰な」。ゲルマン語起源。", "Business has been slack since the new mall opened nearby."),
        e("sparse", False, "形容詞", "まばらな、希薄な", "ラテン語 sparsus(spargere「まき散らす」の過去分詞)から。", "The population is quite sparse in this remote mountain region."),
        e("vast", False, "形容詞", "広大な、莫大な", "ラテン語 vastus「広大な、荒涼とした」。", "The vast desert stretched as far as the eye could see."),
        e("vital", False, "形容詞", "極めて重要な、生命の", "ラテン語 vitalis(vita「生命」)から。", "Clean water is vital for human health."),
    ],
    10: [
        e("descendant", False, "名詞", "子孫", "ラテン語 descendere「下る」(de-+scandere「登る」)の派生語。", "She is a direct descendant of one of the town's founders."),
        e("triumph", False, "名詞", "勝利、大成功", "ラテン語 triumphus。勝利した将軍の凱旋行進を指した。", "Winning the championship was a great triumph for the team."),
        e("emission", False, "名詞", "排出、放出", "ラテン語 emittere「送り出す」(e-+mittere「送る」)から。", "The new law aims to reduce carbon emissions from factories.", collocation="carbon emission"),
        e("deficiency", True, "名詞", "不足、欠乏", "ラテン語 deficere「不足する、欠ける」(de-+facere「作る、する」)から。", "A vitamin D deficiency can weaken your bones over time."),
    ],
    11: [
        e("flourishing", True, "動詞(-ing)", "繁栄する(こと)、生い茂る(こと)", "ラテン語 florere「花咲く」(flos「花」)から。", "The small bakery has been flourishing since it opened last year."),
        e("pledging", False, "動詞(-ing)", "誓う(こと)、約束する(こと)", "古フランス語 plege「保証、担保」。フランク語起源とされる。", "Every member pledged to attend the meeting.", etymology_uncertain=True),
        e("scattering", False, "動詞(-ing)", "まき散らす(こと)、散らばる(こと)", "中英語期の語で、shatter との関連が指摘されるが語源ははっきりしない。", "The wind sent leaves scattering across the yard.", etymology_uncertain=True),
        e("drooping", False, "動詞(-ing)", "うなだれる(こと)、しおれる(こと)", "古ノルド語 drupa「沈む、うなだれる」から。", "The flowers were drooping in the summer heat."),
    ],
    12: [
        e("reptile", False, "名詞", "爬虫類", "ラテン語 reptilis「這う」(repere「這う」)から。", "Snakes and lizards are both types of reptile."),
        e("glacier", False, "名詞", "氷河", "フランス語(フランコプロヴァンス語 glacière 経由)、ラテン語 glacies「氷」から。", "The glacier has retreated significantly over the past fifty years due to warming temperatures."),
        e("blockade", False, "名詞", "封鎖", "block に -ade を付けた語(barricade からの類推)。", "The navy set up a blockade to prevent supplies from reaching the port."),
        e("portfolio", True, "名詞", "作品集、資産構成、書類ばさみ", "イタリア語 portafoglio。portare「運ぶ」+ foglio「葉、紙」。", "The artist showed her portfolio to several galleries before finding one willing to display her work.", collocation="investment portfolio"),
    ],
    13: [
        e("abbreviate", True, "動詞", "短縮する、略す", "ラテン語 abbreviare。ab-+brevis「短い」。", "'Doctor' is often abbreviated to 'Dr.' in writing."),
        e("attest", False, "動詞", "証明する、証言する", "ラテン語 attestari。ad-+testari「証言する」(testis「証人」)。", "Several colleagues can attest to her honesty."),
        e("carve", False, "動詞", "彫る、切り分ける", "古英語 ceorfan「切る」。ゲルマン語起源。", "He carved a small wooden bird for his daughter."),
        e("yield", False, "動詞", "産出する、譲る、屈する", "古英語 gieldan「支払う、報いる」。ゲルマン語起源。", "The field yielded a record harvest this year."),
    ],
    14: [
        e("radiate", False, "動詞", "放射する、輝く", "ラテン語 radiare(radius「光線、車輪の輻」)から。", "The stove radiated heat throughout the small cabin."),
        e("magnify", False, "動詞", "拡大する", "ラテン語 magnificare。magnus「大きい」+ facere「作る」。", "The microscope can magnify a cell up to a thousand times its actual size."),
        e("extract", True, "動詞", "抽出する、引き出す", "ラテン語 extrahere。ex-「外へ」+ trahere「引く」。", "The dentist had to extract two of his wisdom teeth."),
        e("impart", False, "動詞", "伝える、分け与える", "ラテン語 impartire。in-+pars「部分」。", "The old teacher tried to impart his wisdom to the younger staff."),
    ],
    15: [
        e("sank in", False, "句動詞", "徐々に理解される、しみ込む", "sink(古英語 sincan「沈む」)+ in。", "It took a few days for the bad news to sink in."),
        e("let out", False, "句動詞", "外に出す、(秘密などを)漏らす、(声を)発する", "let「許す」+ out。", "She let out a scream when she saw the spider."),
        e("went under", True, "句動詞", "倒産する、沈む", "go「行く」+ under。", "Many small shops went under during the economic downturn."),
        e("lived off", False, "句動詞", "〜に頼って生活する", "live「生活する」+ off。", "He lived off his savings for almost a year after losing his job."),
    ],
    16: [
        e("add up", True, "句動詞", "合計する、つじつまが合う", "add「加える」+ up。", "His story just doesn't add up; something is missing."),
        e("read into", False, "句動詞", "〜を深読みする、〜に別の意味を見出す", "read「読む」+ into。", "Don't read too much into his silence; he's probably just tired."),
        e("take off", False, "句動詞", "離陸する、急成長する、脱ぐ", "take「取る」+ off。", "Sales took off after the product was featured on TV."),
        e("fall out", False, "句動詞", "仲たがいする、抜け落ちる", "fall「落ちる」+ out。", "The two old friends fell out over a business disagreement."),
    ],
    17: [
        e("slip away", True, "句動詞", "こっそり立ち去る、過ぎ去る", "slip「滑る、こっそり動く」+ away。", "He slipped away from the party without saying goodbye."),
        e("tear up", False, "句動詞", "引き裂く、(契約などを)破棄する", "tear「引き裂く」+ up。", "She tore up the letter without reading it."),
        e("drop out", False, "句動詞", "中途退学する、脱落する", "drop「落ちる」+ out。", "He dropped out of college to start his own business."),
        e("follow up", False, "句動詞", "追跡調査する、フォローアップする", "follow「従う」+ up。", "The doctor asked me to follow up with a blood test in a month."),
    ],
    18: [
        e("fed off", False, "句動詞", "〜を糧にする、〜を食べて生きる", "feed「食べさせる、食べる」+ off。", "The rumor fed off people's fear and spread quickly."),
        e("burnt out", False, "句動詞", "燃え尽きる、疲れ果てる", "burn「燃える」+ out。", "She felt completely burnt out after months of overtime work."),
        e("fell through", False, "句動詞", "(計画などが)だめになる、失敗に終わる", "fall「落ちる」+ through。", "Our vacation plans fell through when the flight was canceled."),
        e("ate up", True, "句動詞", "食い尽くす、(時間・お金などを)大量に消費する", "eat「食べる」+ up。", "The long commute ate up two hours of his day."),
    ],
}

ROUND_2025_3 = {
    1: [
        e("evaded", True, "動詞", "免れた、回避した(evade)", "ラテン語 evadere。e-「外へ」+ vadere「行く」。", "He evaded the question by changing the subject."),
        e("sterilized", False, "動詞", "殺菌した、不妊にした(sterilize)", "ラテン語 sterilis「不毛の」+ -ize。", "All the surgical instruments were sterilized before the operation."),
        e("wrecked", False, "動詞", "難破させた、破壊した(wreck)", "古ノルド語系。岸に打ち上げられた物を指した語から。ゲルマン語起源。", "The storm wrecked several boats in the harbor."),
        e("commuted", False, "動詞", "通勤した、(刑を)減刑した(commute)", "ラテン語 commutare「すっかり変える」。com-+mutare「変える」。", "She commuted to the city by train every day."),
    ],
    2: [
        e("reductions", False, "名詞", "削減、縮小", "ラテン語 reducere「引き戻す」。re-+ducere「導く」。", "The company announced reductions in staff due to falling profits."),
        e("nominations", False, "名詞", "ノミネート、指名", "ラテン語 nominare「名付ける」(nomen「名前」)から。", "The film received five nominations at the awards ceremony."),
        e("maneuvers", False, "名詞", "(巧みな)動き、策略、軍事演習", "フランス語 manoeuvre。ラテン語 manu operari「手で働く」から。", "The company used some clever financial maneuvers to avoid bankruptcy."),
        e("perspectives", True, "名詞", "見方、観点", "ラテン語 perspicere「よく見る、見通す」。per-+specere「見る」。", "Hearing different perspectives on the issue helped her form her own opinion."),
    ],
    3: [
        e("supernatural", False, "形容詞", "超自然的な", "super-「〜を超えた」+ natural(ラテン語 natura「自然」)。", "The film is about supernatural events in an old mansion."),
        e("cowardly", False, "形容詞", "臆病な", "coward(古フランス語 coart。coe「尻尾」+ -ard、尻尾を巻いて逃げる様子から)+ -ly。", "It was cowardly of him to blame his colleague for his own mistake."),
        e("spacious", True, "形容詞", "広々とした", "ラテン語 spatiosus「広い」(spatium「空間」)から。", "Their new apartment is much more spacious than the old one."),
        e("compliant", False, "形容詞", "従順な、(規則に)準拠した", "ラテン語 complere「満たす、成し遂げる」から(comply の派生語)。", "The factory had to make changes to remain compliant with safety regulations."),
    ],
    4: [
        e("enrolling", True, "動詞(-ing)", "登録する(こと)、入学する(こと)", "古フランス語 enroller。en-+rolle「巻物、記録簿」。", "She's enrolling in a night class to learn Spanish."),
        e("rebelling", False, "動詞(-ing)", "反抗する(こと)、反乱を起こす(こと)", "ラテン語 rebellare。re-「再び」+ bellare「戦う」(bellum「戦争」)。", "Many teenagers go through a phase of rebelling against their parents."),
        e("radiating", False, "動詞(-ing)", "放射する(こと)", "ラテン語 radiare(radius「光線」)から。", "Warmth was radiating from the fireplace."),
        e("solidifying", False, "動詞(-ing)", "固まる(こと)、強固にする(こと)", "ラテン語 solidus「固い」+ -ify。", "The wax began solidifying as it cooled."),
    ],
    5: [
        e("inhale", False, "動詞", "吸い込む", "ラテン語 inhalare。in-+halare「息をする」。", "Try to inhale slowly and deeply to help you relax."),
        e("haunt", False, "動詞", "(幽霊が)出る、つきまとう", "古フランス語 hanter。語源には諸説あり、確定していない。", "The memory of that accident still haunts her.", etymology_uncertain=True),
        e("obstruct", False, "動詞", "妨げる、塞ぐ", "ラテン語 obstruere。ob-「〜に対して」+ struere「積み上げる」。", "The fallen tree obstructed the road."),
        e("compress", True, "動詞", "圧縮する", "ラテン語 comprimere。com-「共に」+ premere「押す」。", "You can compress the file to make it smaller before sending it."),
    ],
    6: [
        e("forgery", False, "名詞", "偽造", "古フランス語 forgier「鍛造する、形作る」(ラテン語 fabricare)から。", "The painting turned out to be a clever forgery."),
        e("candidacy", False, "名詞", "立候補", "ラテン語 candidatus「白い服を着た人」。古代ローマで公職を求める人が白いトーガを着たことから。", "She announced her candidacy for mayor last week."),
        e("leniency", False, "名詞", "寛大さ、寛容", "ラテン語 lenire「和らげる」(lenis「柔らかい」)から。", "The judge showed leniency because it was the defendant's first offense."),
        e("rivalry", True, "名詞", "競争、対抗意識", "ラテン語 rivalis「同じ小川を使う者」、つまり競争相手(rivus「小川」)から。", "There's a long-standing rivalry between the two sports teams."),
    ],
    7: [
        e("nutritious", False, "形容詞", "栄養のある", "ラテン語 nutrire「養う」+ -itious。", "Fish is generally considered a nutritious source of protein."),
        e("righteous", False, "形容詞", "正義感の強い、公正な", "古英語 rihtwis。riht「正しい」+ wis「〜のような、賢い」。", "He felt a righteous anger at the unfair treatment of his coworker."),
        e("tentative", True, "形容詞", "仮の、暫定的な", "ラテン語 tentare/temptare「試みる」+ -ive。", "We made a tentative plan to meet next Friday, but it might change."),
        e("universal", False, "形容詞", "普遍的な、万国共通の", "ラテン語 universalis(universus「全体の」)から。", "Music is often described as a universal language."),
    ],
    8: [
        e("reprimand", False, "名詞", "叱責、譴責", "フランス語 réprimande。ラテン語 reprimere「押し返す、抑える」(re-+premere「押す」)から。", "He received a formal reprimand for being late to work repeatedly."),
        e("anatomy", True, "名詞", "解剖学、構造", "ギリシャ語 anatome「切開」。ana-「上に」+ temnein「切る」。", "Medical students must study human anatomy in detail."),
        e("esteem", False, "名詞", "尊敬、評価", "ラテン語 aestimare「評価する」から。", "She is held in high esteem by her colleagues."),
        e("distress", False, "名詞", "苦悩、困窮", "古フランス語 destresse。ラテン語 distringere「引き離す、締め付ける」(dis-+stringere「引き締める」)から。", "The lost hikers signaled their distress by lighting a fire."),
    ],
    9: [
        e("warranty", False, "名詞", "保証(書)", "古北フランス語 warantie。ゲルマン語起源の warant(保証人)から(guarantee と同系)。", "The washing machine comes with a two-year warranty."),
        e("fracture", False, "名詞", "骨折、亀裂", "ラテン語 frangere「壊す」から。", "An X-ray revealed a small fracture in his wrist."),
        e("hazard", False, "名詞", "危険、危険要因", "古フランス語 hasard。アラビア語 az-zahr「さいころ」に由来するとされるが確定的ではない。", "Loose wires on the floor are a serious safety hazard.", etymology_uncertain=True),
        e("ascent", True, "名詞", "上昇、登ること", "ラテン語 ascendere「登る」。ad-+scandere「登る」。", "The ascent to the summit took nearly six hours."),
    ],
    10: [
        e("abide", False, "動詞", "従う、耐える", "古英語 abidan。a-+bidan「待つ」。", "All members must abide by the club's rules."),
        e("collide", True, "動詞", "衝突する", "ラテン語 collidere。com-「共に」+ laedere「傷つける」。", "The two cars collided at the intersection."),
        e("subside", False, "動詞", "治まる、沈静化する", "ラテン語 subsidere。sub-「下に」+ sidere「沈む、落ち着く」。", "The pain in her ankle finally began to subside after a week."),
        e("preside", False, "動詞", "議長を務める、司会する", "ラテン語 praesidere。prae-「前に」+ sedere「座る」。", "The vice president will preside over today's meeting."),
    ],
    11: [
        e("detach", True, "動詞", "切り離す、分離する", "フランス語 détacher。de-「反対」+ attacher「取り付ける」。", "Please detach the form along the dotted line and mail it back to us."),
        e("tame", False, "動詞", "飼いならす", "古英語 tam「飼いならされた」。ゲルマン語起源。", "It took months to tame the wild horse."),
        e("unfold", False, "動詞", "広げる、(事態が)展開する", "un-「反対」+ fold(古英語 fealdan「折る」)。", "She unfolded the map to find the quickest route."),
        e("bundle", False, "動詞", "束ねる、まとめる", "中期オランダ語・低地ドイツ語系。bind と関連する語。", "He bundled up the old newspapers for recycling."),
    ],
    12: [
        e("ransom", False, "名詞", "身代金", "古フランス語 raençon。ラテン語 redemptio「買い戻し」と同語源。", "A large ransom was demanded for the missing painting's return."),
        e("precaution", False, "名詞", "予防措置、用心", "ラテン語 praecautio。prae-「前もって」+ cavere「用心する」。", "As a precaution, the school closed early before the storm arrived."),
        e("autonomy", True, "名詞", "自治、自主性", "ギリシャ語 autonomia。autos「自己」+ nomos「法」。", "The region was granted greater autonomy to manage its own affairs."),
        e("conservation", False, "名詞", "保護、保全", "ラテン語 conservare「保つ」から。", "The organization works on the conservation of endangered species."),
    ],
    13: [
        e("gloomy", False, "形容詞", "陰気な、憂鬱な", "中英語 gloumbe「不機嫌な顔をする」。語源は未詳。", "The weather has been gloomy all week.", etymology_uncertain=True),
        e("tender", False, "形容詞", "柔らかい、優しい", "ラテン語 tener「柔らかい、繊細な」から。", "The meat was so tender it fell off the bone."),
        e("cosmopolitan", True, "形容詞", "国際的な、世界主義の", "ギリシャ語 kosmopolites。kosmos「世界」+ polites「市民」。", "London is a cosmopolitan city with people from all over the world."),
        e("menacing", False, "形容詞", "脅すような、威嚇的な", "ラテン語 minacia「脅し」(minari「脅す」)から。", "The dog gave a menacing growl as the stranger approached."),
    ],
    14: [
        e("perch", False, "動詞", "(鳥が)止まる、腰かける", "古フランス語 perche「棒、さお」。ラテン語 pertica から。", "A small bird perched on the windowsill."),
        e("breeze", False, "動詞", "軽やかに通り抜ける、(物事を)楽々とこなす", "スペイン語・ポルトガル語 briza「北東の風」からとされるが語源は未詳。", "She breezed through the exam without any difficulty.", etymology_uncertain=True),
        e("gleam", True, "動詞", "きらりと光る", "古英語 glæm「輝き」。ゲルマン語起源。", "The polished silver gleamed under the lights."),
        e("sizzle", False, "動詞", "ジュージュー音を立てる", "その音を模した擬音語(オノマトペ)。", "The bacon sizzled loudly in the frying pan."),
    ],
    15: [
        e("live off", False, "句動詞", "〜に頼って生活する", "live「生活する」+ off。", "He lives off a small pension."),
        e("make for", True, "句動詞", "〜の方へ向かう、〜に役立つ", "make「作る、進む」+ for。", "A good night's sleep makes for a productive day."),
        e("pass on", False, "句動詞", "伝える、(申し出などを)辞退する", "pass「渡す」+ on。", "Please pass on my regards to your family."),
        e("wipe out", False, "句動詞", "全滅させる、一掃する", "wipe「拭く」+ out。", "The disease wiped out most of the region's crops."),
    ],
    16: [
        e("iron out", False, "句動詞", "(問題などを)解決する", "iron「アイロンをかける」+ out(しわを伸ばすイメージ)。", "The two companies met to iron out their differences."),
        e("toss in", False, "句動詞", "気軽に付け加える、おまけに付ける", "toss「軽く投げる」+ in。", "The salesman offered to toss in free delivery."),
        e("take on", True, "句動詞", "引き受ける、(人を)雇う", "take「取る」+ on。", "The firm decided to take on two new employees this month."),
        e("size up", False, "句動詞", "評価する、見極める", "size「大きさを測る」+ up。", "She quickly sized up the situation before making a decision."),
    ],
    17: [
        e("sound off", False, "句動詞", "大声で不満を言う", "sound「音を出す」+ off。", "He's always sounding off about the government on social media."),
        e("draw back", False, "句動詞", "後ずさりする、手を引く", "draw「引く」+ back。", "She drew back from the deal at the last minute."),
        e("turn up", False, "句動詞", "現れる、見つかる", "turn「向く」+ up。", "He finally turned up an hour late for the meeting."),
        e("rule out", True, "句動詞", "除外する、可能性を排除する", "rule「線を引く、裁定する」+ out。", "Doctors have ruled out a serious illness after running several tests."),
    ],
    18: [
        e("chip in", False, "句動詞", "(お金などを)出し合う、割り込んで発言する", "chip「(お金の)チップ、かけら」+ in。", "Everyone chipped in to buy the teacher a farewell gift."),
        e("pull off", False, "句動詞", "うまくやり遂げる", "pull「引く」+ off。", "It was a difficult project, but the team managed to pull it off."),
        e("stick around", True, "句動詞", "その場に留まる", "stick「くっつく、留まる」+ around。", "Can you stick around after the meeting to help clean up?"),
        e("bear up", False, "句動詞", "持ちこたえる、耐える", "bear「耐える、支える」+ up。", "Despite the bad news, she bore up remarkably well."),
    ],
}

ROUND_2025_2 = {
    1: [
        e("stocky", False, "形容詞", "がっしりした、ずんぐりした", "stock(古英語 stocc「木の幹」)+ -y。幹のようにがっしりした体格から。", "He has a stocky build from years of weight training."),
        e("cheery", False, "形容詞", "陽気な、明るい", "cheer(古フランス語 chiere「顔つき、表情」)+ -y。", "She greeted everyone with a cheery smile."),
        e("ambitious", False, "形容詞", "野心的な、意欲的な", "ラテン語 ambitiosus。ambire「(票を求めて)歩き回る」から。", "He set an ambitious goal of finishing the marathon in under four hours."),
        e("remote", True, "形容詞", "遠隔の、へんぴな", "ラテン語 remotus(removere「取り除く」の過去分詞)から。", "They live in a remote village with no paved roads."),
    ],
    2: [
        e("commendable", False, "形容詞", "称賛に値する", "ラテン語 commendare「委ねる、推薦する」。com-+mandare「命じる」。", "Her effort to help the new students was commendable."),
        e("impressionable", False, "形容詞", "感化されやすい、影響を受けやすい", "impression(ラテン語 imprimere「押し付ける」)+ -able。", "Children are highly impressionable and often copy what they see on TV."),
        e("audible", True, "形容詞", "聞き取れる、可聴の", "ラテン語 audire「聞く」+ -ible。", "Her voice was barely audible over the noise of the crowd."),
        e("eligible", False, "形容詞", "資格のある、適格な", "ラテン語 eligere「選び出す」。e-+legere「選ぶ、集める」。", "You must be over eighteen to be eligible to vote."),
    ],
    3: [
        e("invaders", False, "名詞", "侵略者", "ラテン語 invadere「侵入する」。in-+vadere「行く」。", "The castle walls were built to keep out invaders."),
        e("commuters", True, "名詞", "通勤者", "commute(ラテン語 commutare「すっかり変える」、運賃をまとめて定額にする意味から発達)+ -er。", "The train was packed with commuters heading into the city."),
        e("composers", False, "名詞", "作曲家", "ラテン語 componere「組み立てる」。com-+ponere「置く」。", "Beethoven is one of the most famous composers in history."),
        e("installers", False, "名詞", "設置業者", "install(中世ラテン語 installare。in-+stallum「席」)+ -er。", "The installers spent the whole day setting up the new kitchen."),
    ],
    4: [
        e("commission", True, "名詞", "委託、委員会、手数料", "ラテン語 commissio「委ねること」。committere「委ねる」から。", "The artist received a commission to paint a mural for the new library."),
        e("script", False, "名詞", "台本、脚本", "ラテン語 scriptum「書かれたもの」(scribere「書く」)から。", "The actors rehearsed the script for weeks before the performance."),
        e("fragment", False, "名詞", "断片、破片", "ラテン語 fragmentum「砕かれた一片」(frangere「壊す」)から。", "Archaeologists found a fragment of ancient pottery at the site."),
        e("molecule", False, "名詞", "分子", "フランス語 molécule。近代ラテン語 molecula(ラテン語 moles「かたまり」の指小形)から。", "A water molecule consists of two hydrogen atoms and one oxygen atom."),
    ],
    5: [
        e("virtue", False, "名詞", "美徳、長所", "ラテン語 virtus「勇敢さ、卓越性」(vir「男」)から。", "Patience is considered a virtue in many cultures."),
        e("fatigue", True, "名詞", "疲労", "フランス語 fatigue。ラテン語 fatigare「疲れさせる」から。", "After the long flight, she was overcome with fatigue."),
        e("oversight", False, "名詞", "見落とし、監督", "over-+sight。「見過ごすこと」と「監督すること」の両方の意味が同じ語から発達した。", "The mistake in the report was a simple oversight, not intentional."),
        e("perception", False, "名詞", "認識、知覚", "ラテン語 percipere「しっかり捉える、理解する」。per-+capere「取る」。", "Public perception of the new policy has changed significantly."),
    ],
    6: [
        e("indifferently", False, "副詞", "無関心に", "in-「否定」+ different(ラテン語 differre)+ -ly。", "He shrugged indifferently when asked about the results."),
        e("appealingly", False, "副詞", "魅力的に", "appeal(ラテン語 appellare「呼びかける」)+ -ing + -ly。", "The dessert was arranged appealingly on the plate."),
        e("abruptly", True, "副詞", "突然に、ぶっきらぼうに", "ラテン語 abruptus「断ち切られた」(abrumpere、ab-+rumpere「破る」)から。", "The meeting ended abruptly when the fire alarm went off."),
        e("timidly", False, "副詞", "おずおずと、臆病に", "ラテン語 timidus「臆病な」(timere「恐れる」)から。", "The new student timidly raised her hand to answer the question."),
    ],
    7: [
        e("clarify", False, "動詞", "明確にする", "ラテン語 clarificare。clarus「明るい、明確な」+ facere「作る」。", "Could you clarify what you meant by that comment?"),
        e("implement", False, "動詞", "実行する、実施する", "ラテン語 implere「満たす、成し遂げる」。in-+plere「満たす」。", "The school plans to implement a new grading system next year."),
        e("tolerate", True, "動詞", "我慢する、容認する", "ラテン語 tolerare「耐える」から。", "The teacher would not tolerate any form of bullying in her classroom."),
        e("humiliate", False, "動詞", "屈辱を与える", "ラテン語 humiliare「低くする」(humilis「低い、謙虚な」、humus「地面」)から。", "He felt humiliated after tripping in front of the whole class."),
    ],
    8: [
        e("massive", True, "形容詞", "巨大な、大規模な", "フランス語 massif。ラテン語 massa「かたまり」から。", "A massive crowd gathered to watch the fireworks."),
        e("amusing", False, "形容詞", "面白い、愉快な", "フランス語 amuser「楽しませる、気をそらす」。a-+muser「じっと見つめる」。", "He told an amusing story about his trip to Italy."),
        e("graceful", False, "形容詞", "優雅な", "grace(ラテン語 gratia「魅力、恩恵」、gratus「喜ばしい」)+ -ful。", "The dancer moved across the stage with graceful, fluid movements."),
        e("hesitant", False, "形容詞", "ためらいがちな", "ラテン語 haesitare「立ち止まる、ためらう」(haerere「くっつく」の反復形)から。", "She was hesitant to share her opinion in front of so many people."),
    ],
    9: [
        e("outlaw", False, "動詞", "非合法化する、禁止する", "古ノルド語 utlagi「法の外にある者」。ut「外」+ lagu「法」。", "The city voted to outlaw single-use plastic bags."),
        e("elevate", False, "動詞", "高める、昇進させる", "ラテン語 elevare。e-「外へ」+ levare「持ち上げる」(levis「軽い」)。", "Regular exercise can elevate your mood."),
        e("plead", False, "動詞", "懇願する、抗弁する", "古フランス語 plaidier「法廷で弁論する」。ラテン語 placitum「決定、合意」から。", "She pleaded with her boss for one more chance."),
        e("accommodate", True, "動詞", "収容する、対応する、便宜を図る", "ラテン語 accommodare。ad-+commodare「適合させる」(commodus「都合の良い」)。", "The hotel can accommodate up to three hundred guests."),
    ],
    10: [
        e("alleged", False, "形容詞", "申し立てられた、疑惑の", "アングロフレンチ語 alegier。後にラテン語 allegare「証拠として持ち出す」と混同されて意味が発達した。", "The alleged thief was arrested near the scene.", etymology_uncertain=True),
        e("forthcoming", True, "形容詞", "今度の、近づいている、協力的な", "forth(古英語 forð「前方へ」)+ coming。", "Details about the forthcoming election will be announced next week."),
        e("blissful", False, "形容詞", "この上なく幸せな", "bliss(古英語 bliss、blithe「喜ばしい」と関連)+ -ful。", "They spent a blissful week relaxing on the beach."),
        e("fainthearted", False, "形容詞", "臆病な、気弱な", "faint(古フランス語 feint「弱った、偽った」、feindre から)+ hearted。", "This roller coaster is not for the fainthearted."),
    ],
    11: [
        e("sinister", False, "形容詞", "不吉な、邪悪な", "ラテン語 sinister「左の」。左側は古来不吉とされたことから意味が発展した。", "There was something sinister about the way he smiled."),
        e("indebted", True, "形容詞", "恩義がある、借りがある", "in-+debt(ラテン語 debitum、debere「借りている」)+ -ed。", "I'm deeply indebted to my mentor for all the guidance she gave me."),
        e("perilous", False, "形容詞", "危険な", "ラテン語 periculum「危険、試練」+ -ous。", "The climbers faced a perilous journey up the icy mountain."),
        e("doomed", False, "形容詞", "運命づけられた、破滅する運命の", "古英語 dom「判断、裁き」+ -ed。", "Critics said the project was doomed to fail from the start."),
    ],
    12: [
        e("appoint", False, "動詞", "任命する", "古フランス語 apointer「取り決める」。a point「ある点に」から。", "The board voted to appoint her as the new director."),
        e("import", False, "動詞", "輸入する", "ラテン語 importare。in-+portare「運ぶ」。", "The country imports most of its oil from abroad."),
        e("acquaint", False, "動詞", "知らせる、慣れさせる", "古フランス語 acointier。ラテン語 accognitare「知らせる」(ad-+cognoscere「知る」)から。", "Let me acquaint you with the new office procedures."),
        e("escort", True, "動詞", "護衛する、付き添う", "フランス語 escorte。イタリア語 scorta(scorgere「導く、見分ける」)から。", "Security guards escorted the celebrity through the crowd."),
    ],
    13: [
        e("aggression", False, "名詞", "攻撃(性)、侵略", "ラテン語 aggredi「近づく、攻撃する」。ad-+gradi「歩く」。", "The country was condemned for its acts of aggression against its neighbor."),
        e("substitute", False, "名詞", "代用品、代理人", "ラテン語 substituere。sub-「下に」+ statuere「立てる」。", "She used a sugar substitute in her coffee."),
        e("relegation", False, "名詞", "降格", "ラテン語 relegare「追いやる」。re-+legare「委任して送る」。", "The team's poor performance led to their relegation to a lower division."),
        e("batch", True, "名詞", "一まとめ、一団、ひと窯分", "古英語 bæcce「焼かれたもの」。bake と同系。", "She baked a fresh batch of cookies for the school fair."),
    ],
    14: [
        e("dehydrated", False, "動詞", "脱水した(dehydrate)", "de-「除去」+ hydrate(ギリシャ語 hydor「水」)。", "He felt dehydrated after running in the summer heat without drinking water."),
        e("evoked", True, "動詞", "呼び起こした、想起させた(evoke)", "ラテン語 evocare。e-「外へ」+ vocare「呼ぶ」。", "The old song evoked memories of her childhood."),
        e("acquired", False, "動詞", "取得した、身につけた(acquire)", "ラテン語 acquirere。ad-+quaerere「求める」。", "She acquired fluency in French after living in Paris for two years."),
        e("posed", False, "動詞", "ポーズをとった、(問題を)引き起こした(pose)", "フランス語 poser「置く」。ラテン語 pausare「休止する」と ponere「置く」が混ざって発達した。", "The new policy posed a serious challenge for small businesses."),
    ],
    15: [
        e("take in", False, "句動詞", "理解する、取り込む、だます", "take「取る」+ in。", "It's a lot of information to take in at once."),
        e("even out", False, "句動詞", "均等になる、平らにする", "even「平らな」+ out。", "House prices tend to even out over the long term."),
        e("figure on", True, "句動詞", "〜を見込む、当てにする", "figure「見積もる」+ on。", "We didn't figure on so many people showing up to the event."),
        e("make do", False, "句動詞", "何とかやりくりする", "make「する」+ do。", "We didn't have any butter, so we had to make do with oil instead."),
    ],
    16: [
        e("hold out", False, "句動詞", "持ちこたえる、要求を拒み続ける", "hold「保つ」+ out。", "The supplies should hold out for another week."),
        e("shoot down", True, "句動詞", "(提案などを)却下する、撃墜する", "shoot「撃つ」+ down。", "The committee shot down his proposal almost immediately."),
        e("get over", False, "句動詞", "(病気・ショックなどから)立ち直る", "get「至る」+ over。", "It took her months to get over the loss of her job."),
        e("snap up", False, "句動詞", "すぐに買う、素早く手に入れる", "snap「ぱっとつかむ」+ up。", "Shoppers snapped up the discounted items within minutes."),
    ],
    17: [
        e("tune up", False, "句動詞", "調整する、調律する", "tune「調律する」+ up。", "The mechanic tuned up the engine before the long trip."),
        e("touch on", False, "句動詞", "〜に軽く触れる、言及する", "touch「触れる」+ on。", "The lecture briefly touched on the economic effects of the policy."),
        e("tear down", True, "句動詞", "取り壊す", "tear「引き裂く」+ down。", "The old stadium was torn down to make way for a new one."),
        e("free up", False, "句動詞", "(時間・資金などを)確保する、空ける", "free「自由にする」+ up。", "Automating the process freed up more time for creative work."),
    ],
    18: [
        e("get down", True, "句動詞", "取りかかる、(気分を)滅入らせる", "get「至る」+ down。", "Let's get down to business and discuss the budget."),
        e("round out", False, "句動詞", "完全なものにする、締めくくる", "round「丸くする」+ out。", "A dessert would round out the meal nicely."),
        e("die away", False, "句動詞", "次第に消えていく、弱まる", "die「消える」+ away。", "The sound of the music slowly died away in the distance."),
        e("lay out", False, "句動詞", "配置する、説明する、(お金を)使う", "lay「置く」+ out。", "The manager laid out the plan for the next quarter."),
    ],
}
