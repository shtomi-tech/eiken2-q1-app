"""Long-reading (大問3) content for the Eiken Pre-1 mode: paragraph/sentence
split, evidence sentences, Japanese translations, explanations, and a
content-summary (fill-in-the-blank) per passage.

All Japanese content (paragraph translations, question translations,
explanations, summary text) was newly written by the agent for this app; it
is not an official Eiken publication. English paragraph/sentence text and
question/choice text are taken from the official past-exam PDF (already
present in data/pre1_{round}.json) and are only re-split into
paragraphs/sentences here, not altered.

Evidence indices are [paragraph_index, sentence_index] pairs, 0-based, into
this file's own paragraphs[].sentences[] arrays (verified by
scripts/verify_pre1_q3.py against the source reading.part3 text).
"""


def para(text, translation):
    sentences = [s.strip() for s in SENT_SPLIT(text)]
    return {"sentences": sentences, "translation": translation}


import re as _re


def SENT_SPLIT(text):
    # Splits on sentence-ending punctuation -- optionally followed by a
    # closing quote, which is kept attached to the sentence it closes --
    # then a space and a capital letter/quote. Safe for these six passages
    # (checked by hand: no abbreviations like "Dr." or decimal numbers that
    # would be mis-split).
    pattern = r'(?:(?<=[.!?])|(?<=[.!?]["\']))\s+(?=[A-Z"\'])'
    parts = _re.split(pattern, text.strip())
    return [p for p in parts if p]


def question(q, evidence_paragraph, evidence_sentences, explanation, translation):
    return {
        "q": q,
        "evidence": {"paragraph": evidence_paragraph, "sentences": evidence_sentences},
        "explanation": explanation,
        "translation": translation,
    }


def summary(sections, blanks, distractors):
    return {"sections": sections, "blanks": blanks, "distractors": distractors}


# ---------------------------------------------------------------------------
# 2026-1
# ---------------------------------------------------------------------------

ROUND_2026_1 = {
    "1": {
        "paragraphs": [
            para(
                "The ancient settlement of Uruk was located in a fertile delta between the Tigris and Euphrates rivers in the region of Sumer, in what is now southern Iraq. Uruk began life as a village. However, toward the end of the fourth millennium BC, it had developed to such an extent that some historians consider it the world's first city. Behind this remarkable growth were several factors, including technological advancements that increased agricultural efficiency, such as the construction of irrigation canals to funnel water to fields and orchards. These advances not only allowed Uruk to support a growing population but also to create a surplus, which could then be traded. Expansion continued, and by the third millennium BC, Uruk was thriving as a Sumerian cultural and religious center, a military power, and the hub of a trade network.",
                "古代の集落ウルクは、現在のイラク南部にあたるシュメール地方、ティグリス川とユーフラテス川の間の肥沃なデルタ地帯に位置していた。ウルクは一つの村として始まった。しかし、紀元前4千年紀の終わりごろまでには、一部の歴史家が世界最初の都市とみなすほどに発展していた。この著しい成長の背景には、灌漑用水路を建設して畑や果樹園に水を引くなど、農業効率を高めた技術的進歩を含むいくつかの要因があった。こうした進歩により、ウルクは増加する人口を支えられただけでなく、交易に回せる余剰も生み出せるようになった。拡大は続き、紀元前3千年紀までには、ウルクはシュメールの文化・宗教の中心地、軍事大国、そして交易網の中心として繁栄していた。",
            ),
            para(
                "As Uruk grew, it helped shape the political and cultural landscape of the Sumer region, influencing other cities that developed around the same period. Various other developments helped Uruk evolve into the sophisticated city it became, including its early use of cuneiform script. The script was mainly written on clay tablets, many of which survive to this day. In its early form, it was relatively simple, with pictures representing goods, but it allowed for rudimentary recordkeeping. The writing system gradually became more sophisticated and was used for accounting and general administrative matters, which helped facilitate the governance of the increasingly complex city. Over time, the script was used in the Sumer region to keep records in fields such as economics, politics, and religion.",
                "ウルクは成長するにつれて、シュメール地方の政治・文化の枠組みを形作る一助となり、同時期に発展した他の都市にも影響を与えた。楔形文字の早期使用を含む、他のさまざまな発展がウルクを洗練された都市へと進化させた。この文字は主に粘土板に書かれ、その多くが現在まで残っている。初期の形態では、品物を表す絵を用いた比較的単純なものだったが、簡単な記録を残すことはできた。この書記体系は次第に洗練され、会計や一般的な行政事務に用いられるようになり、複雑化する都市の統治を助けた。やがて、この文字はシュメール地方で経済・政治・宗教といった分野の記録を残すためにも使われるようになった。",
            ),
            para(
                "However, Uruk's dominant position was not to last forever. Uruk had competed with neighboring Sumerian cities for hundreds of years, leaving them all vulnerable to forces from other regions. In the latter half of the third millennium BC, the Akkadians conquered much of Sumer. Despite this conquest, Uruk's religious districts were respected and protected, and after Akkadian rule came to an end, a renaissance of Sumerian culture occurred. Although later conflicts and invasions meant that Uruk would not return to its earlier heights, it remained an important city for many centuries to come. Archaeological excavations have revealed an immense city wall, sculptures, artworks, large stone buildings decorated with mosaics, and numerous pyramidlike structures called ziggurats that were topped with temples all of which point to the historical significance of Uruk.",
                "しかし、ウルクの優位な立場は永遠には続かなかった。ウルクは近隣のシュメール諸都市と何百年にもわたって競い合っており、そのためどの都市も他地域からの勢力に対して脆弱になっていた。紀元前3千年紀の後半、アッカド人がシュメールの大部分を征服した。この征服にもかかわらず、ウルクの宗教地区は尊重され保護され、アッカドの支配が終わった後にはシュメール文化の復興が起こった。その後の紛争や侵略により、ウルクがかつての高みに戻ることはなかったものの、その後も長きにわたって重要な都市であり続けた。考古学的発掘により、巨大な市壁、彫刻、美術品、モザイクで装飾された大きな石造建築物、そして神殿を頂く数多くのジッグラト(階段状の塔)が発見されており、これらすべてがウルクの歴史的重要性を物語っている。",
            ),
        ],
        "questions": [
            question(25, 0, [4], "第1段落では、灌漑技術によって余剰食料を生み出せたことが、ウルクの急成長を支えた重要な要因として説明されている。選択肢2はこの「必要以上の食料を生産できたこと」を的確に言い換えている。",
                     "この文章の著者は、ウルクの発展について何と述べているか。\n1 農業効率を高めた技術的進歩がなくても、急速な進歩は可能だっただろう。\n2 重要な特徴の一つは、必要量以上の食料を生産できたことであり、これがより急速な変化を可能にした。\n3 農業用水路の建設は、増加する人口の需要に追いつくことができなかった。\n4 自国の人口のために収穫物を蓄えすぎたため、最も利益の大きい交易の機会を逃した。"),
            question(26, 1, [4], "第2段落によれば、楔形文字は次第に洗練され、会計や行政事務に使われるようになり、複雑化する都市の統治を助けた。選択肢4はこの「複雑化する社会の統治を助ける手段になった」という点を正しくとらえている。",
                     "楔形文字について分かることの一つは何か。\n1 その使用がもたらした利点は、ウルクが競合都市に対して優位を保つには十分ではなかった。\n2 ウルクの発展に役立つ用途はあったが、複雑な行政事務にはあまり適していなかった。\n3 最初は宗教目的で発達したが、後に商業や統治の場でも採用された。\n4 増々複雑化する社会の統治を助ける手段を、ウルクにもたらした。"),
            question(27, 2, [3], "最終段落では、アッカド人による征服にもかかわらず、ウルクの宗教地区は尊重・保護されたと述べられている。選択肢1はこの内容と一致する。",
                     "最終段落に基づくと、次のうちどの記述が正しいか。\n1 シュメール地方は外部勢力に攻撃され打ち破られたが、ウルクの宗教的遺産は破壊されなかった。\n2 ウルクは宗教建築や芸術技法の一部を、シュメールの近隣都市から取り入れた。\n3 アッカド人はウルクを打ち破るために、城壁や石造建築物の多くを破壊しなければならなかった。\n4 ウルクの衰退は、近隣のシュメール諸都市がアッカド人と同盟を結んだことに起因する。"),
        ],
        "summary": summary(
            sections=[
                {"label": "¶1 ウルクの成長", "lines": [
                    ["ウルクは、シュメール地方の肥沃なデルタ地帯に位置する村として始まった。"],
                    ["灌漑技術による農業効率の向上で、人口を支えるだけでなく", {"blank": 1}, "も生み出せるようになった。"],
                ]},
                {"label": "¶2 楔形文字", "lines": [
                    ["楔形文字は当初、", {"blank": 2}, "単純な記録手段だった。"],
                    ["次第に洗練され、", {"blank": 3}, "にも使われるようになった。"],
                ]},
                {"label": "¶3 衰退と遺産", "lines": [
                    ["アッカド人による征服後も、ウルクの", {"blank": 4}, "は保護された。"],
                    ["考古学的発掘により、市壁や", {"blank": 5}, "などが発見され、歴史的重要性を示している。"],
                ]},
            ],
            blanks=[
                {"id": 1, "answer": "交易に回せる余剰食料", "accepted": ["交易に回せる余剰食料", "余剰食料", "交易できる余剰"]},
                {"id": 2, "answer": "品物を表す絵を使った", "accepted": ["品物を表す絵を使った", "絵を使った単純な記録"]},
                {"id": 3, "answer": "会計や行政事務", "accepted": ["会計や行政事務", "会計や統治の記録"]},
                {"id": 4, "answer": "宗教地区", "accepted": ["宗教地区", "宗教施設"]},
                {"id": 5, "answer": "ジッグラト", "accepted": ["ジッグラト", "階段状の塔"]},
            ],
            distractors=["軍事同盟", "文字が読めない住民", "近隣都市との合併", "水不足", "貨幣経済の導入"],
        ),
    },
    "2": {
        "paragraphs": [
            para(
                "While the concept of artificially increasing animal intelligence through technology once seemed like science fiction, recent advances suggest it may be achievable. One promising approach for doing so is genetic manipulation. For instance, in 2014, researchers discovered that a human gene called FOXP2 was related to acquiring language skills in humans. When mice were genetically altered to produce it, they were able to learn a route through a maze much more rapidly than their unmodified counterparts, indicating that the gene had significantly enhanced their memory, which is an essential component of intelligence. This research is preliminary, however, and intelligence depends on a multitude of genes, so significant technical and ethical hurdles must be overcome before such advancements can be responsibly applied.",
                "テクノロジーによって動物の知能を人為的に高めるという発想は、かつてはSF的なものに思えたが、近年の進歩によりそれが実現可能かもしれないことが示唆されている。そのための有望な方法の一つが遺伝子操作である。例えば2014年、研究者たちはFOXP2と呼ばれるヒトの遺伝子が、人間の言語能力の獲得に関係していることを発見した。この遺伝子を発現するよう遺伝子操作されたマウスは、迷路を通り抜けるルートを、操作されていない個体よりもはるかに速く学習できるようになり、これは知能の重要な構成要素である記憶力がこの遺伝子によって大きく向上したことを示していた。しかし、この研究はまだ初歩的な段階にあり、知能は非常に多くの遺伝子に依存しているため、こうした進歩を責任を持って応用する前には、大きな技術的・倫理的な壁を乗り越えなければならない。",
            ),
            para(
                "An aspect of animal uplift that needs to be considered is the possibility of unintended outcomes. One experiment compared fish with larger brains that were bred together to fish with smaller brains that were bred together. The young of the larger brained fish tended to have even bigger brains, and the babies' performance on cognitive tests was superior to that of fish with smaller brains. However, the researchers also observed that these fish produced young that had smaller digestive systems, and this in turn seems to have led them to produce fewer offspring. This is likely due to the fact that larger brains require substantially more energy. As this experiment indicates, trying to boost intelligence may disrupt other physical attributes, leading to consequences that extend beyond the individual animals to entire populations.",
                "動物のアップリフト(能力向上)について考慮すべき点の一つに、意図しない結果が生じる可能性がある。ある実験では、脳の大きい個体同士を交配させた魚と、脳の小さい個体同士を交配させた魚を比較した。脳の大きい魚の子は、さらに脳が大きくなる傾向があり、認知テストの成績も脳の小さい魚の子より優れていた。しかし研究者たちは、これらの魚が消化器官の小さい子を産むことにも気づき、そのためこの魚たちが産む子の数自体が少なくなっているようだと観察した。これはおそらく、脳が大きいほど格段に多くのエネルギーを必要とするためである。この実験が示すように、知能を高めようとする試みは他の身体的特徴を乱す可能性があり、その影響は個体だけでなく個体群全体にまで及びうる。",
            ),
            para(
                "Furthermore, opponents of animal uplift point out that the process would likely involve surgical procedures on healthy animals. There would almost certainly be psychological consequences as well, and an uplifted animal's existence might well be completely transformed. A mouse, whose life would normally be a simple matter of survival, could instead be thrust into a confusing, possibly terrifying awareness of how brief its lifespan is and how little control it has over its environment. There is also the issue of whether making such radical alterations to an animal's biology could ever be considered ethical, since it would be impossible for the creature to give consent beforehand, especially since the procedures would probably not be reversible.",
                "さらに、動物アップリフトに反対する人々は、その過程には健康な動物への外科的処置がほぼ確実に伴うだろうと指摘する。心理的な影響もほぼ間違いなく生じ、アップリフトされた動物の存在のあり方は完全に変わってしまうかもしれない。本来なら生きることが単なる生存の問題であるはずのマウスが、代わりに、自分の寿命がいかに短いか、自分の環境をいかにコントロールできないかという、混乱を招く、場合によっては恐ろしい自覚に突然投げ込まれるかもしれない。また、動物の生物学的性質にこれほど根本的な改変を加えることが倫理的に許されるのかという問題もある。というのも、その処置はおそらく元に戻せないものであるうえ、当の生き物が事前に同意を与えることは不可能だからである。",
            ),
            para(
                "George Dvorsky, chairperson of the Institute for Ethics and Emerging Technologies, however, argues that withholding animal uplift is itself unethical. Animals have long been sacrificed as test subjects during the creation of new surgical procedures or the development of medicines that have increased human life expectancy, and if humans artificially increase our own intelligence, animals will likely be sacrificed for that as well. According to Dvorsky, in light of increased awareness of animal rights and given the tremendous role that animals have played in improving human existence, withholding advances that could improve their intelligence would be just as unethical as withholding them from a group of humans who lack sufficient wealth to afford them. While the ability to uplift animals would have undeniable benefits, it is also true that we face an ethical dilemma when altering another species. Clearly, there are difficult decisions about animal uplift that need to be made.",
                "しかし、倫理・新興技術研究所の議長であるジョージ・ドヴォルスキーは、動物アップリフトを行わないこと自体が非倫理的だと主張する。動物は、新しい外科手術や、人間の寿命を延ばしてきた医薬品の開発の過程で、長らく実験対象として犠牲にされてきており、もし人間が自らの知能を人為的に高めるならば、そのためにも動物が犠牲にされる可能性が高い。ドヴォルスキーによれば、動物の権利に対する意識が高まっていること、そして動物が人間の生活向上に多大な役割を果たしてきたことを踏まえると、動物の知能を向上させうる技術を提供しないことは、それを買う十分な資力を持たない人間の集団に提供しないことと同じくらい非倫理的だという。動物をアップリフトする能力には紛れもない利点がある一方で、別の種を改変する際には倫理的なジレンマに直面することもまた事実である。動物アップリフトについては、下さなければならない難しい決断が明らかに存在する。",
            ),
        ],
        "questions": [
            question(28, 0, [3, 4], "第1段落では、FOXP2遺伝子を持つマウスは記憶力という知能の一要素が向上した一方、この研究はまだ初歩的な段階であり、知能には多数の遺伝子が関わるため克服すべき課題が多いと述べられている。選択肢2はこの内容と一致する。",
                     "FOXP2遺伝子に関する研究について分かることの一つは何か。\n1 マウスの記憶力への影響はわずかだったため、マウスの知能全体が向上したとは言えない。\n2 マウスの知能の一要素には影響を与えたが、これはおそらく複雑な過程の初期の一歩に過ぎない。\n3 マウスどうしのコミュニケーションの方法が、以前考えられていたより高度であることを示した。\n4 マウスが、研究者がこれまで気づいていなかった種類の知能を実際に持っている可能性を示している。"),
            question(29, 1, [3, 5], "第2段落では、脳の大きい魚の子は消化器官が小さくなり、産む子の数も少なくなったことが述べられており、知能を高めようとする試みが他の身体的特徴に影響しうることを示している。選択肢3が一致する。",
                     "魚の実験は、動物アップリフトの試みについて何を示しているか。\n1 動物がどれだけ賢くなれるかには限界があり、どれだけ交配を重ねてもそれを超えることはできない。\n2 動物の知能を高めようとする試みが、意図とは逆の効果をもたらす可能性がある。\n3 動物の知能を高めようとする試みは、その動物の生物学的な他の重要な側面に影響を及ぼす可能性がある。\n4 動物の知能をわずかに高めることは可能だが、それが子孫に受け継がれる可能性は低い。"),
            question(30, 2, [3], "第3段落では、動物アップリフトの倫理的問題として、動物が事前に処置への同意を与えることができない点が挙げられている。選択肢1が一致する。",
                     "第3段落で示されている、動物アップリフトに反対する論拠の一つは何か。\n1 動物は自分の身に何が起ころうとしているかに同意することができないため、行うべきではない。\n2 動物の行動に大きな変化をもたらし、それが環境に悪影響を及ぼす可能性がある。\n3 脳の働きについての知識が不足しているため、動物の脳に対する手術のリスクがより大きくなる可能性が高い。\n4 その処置を受けた動物の生存本能を低下させる重大なリスクがある。"),
            question(31, 3, [1, 2], "第4段落でドヴォルスキーは、人間が自らの知能を高めるためにも動物が犠牲にされるだろうと述べ、それゆえ動物への技術提供を拒むことは非倫理的だと論じている。これは、人間が動物を利用するなら動物への義務も増すという考え方であり、選択肢4と一致する。",
                     "ジョージ・ドヴォルスキーは動物アップリフトについてどう考えているか。\n1 動物をアップリフトしようとする際に傷つけないよう、人間はより優れた外科手術の技術を開発する必要がある。\n2 動物をアップリフトするために使われるのと同じ医学的進歩が、動物がより長く健康的な生活を送る助けにもなる可能性が高い。\n3 人間は、動物をアップリフトすることが正しいかどうかを検討する前に、そのために必要な技術を開発すべきだ。\n4 人間が自らの知能を高める過程で動物を利用するなら、それは人間が動物をアップリフトする義務を増すことになる。"),
        ],
        "summary": summary(
            sections=[
                {"label": "¶1 遺伝子操作という方法", "lines": [
                    ["FOXP2という", {"blank": 1}, "の遺伝子をマウスに導入すると、迷路学習が速くなり", {"blank": 2}, "が向上した。"],
                    ["ただし研究はまだ初歩的な段階である。"],
                ]},
                {"label": "¶2 意図しない結果", "lines": [
                    ["脳を大きくした魚の子は", {"blank": 3}, "が小さくなり、産む子の数も減った。"],
                ]},
                {"label": "¶3-4 倫理をめぐる賛否", "lines": [
                    ["反対派は、動物が処置に", {"blank": 4}, "できない点を問題視する。"],
                    ["ドヴォルスキーは、人間はこれまでも医療の進歩のために動物を", {"blank": 5}, "きたのだから、能力向上の技術を与えないことも同様に非倫理的だと主張する。"],
                ]},
            ],
            blanks=[
                {"id": 1, "answer": "人間", "accepted": ["人間", "ヒト"]},
                {"id": 2, "answer": "記憶力", "accepted": ["記憶力", "記憶"]},
                {"id": 3, "answer": "消化器官", "accepted": ["消化器官", "消化器"]},
                {"id": 4, "answer": "事前に同意", "accepted": ["事前に同意", "同意"]},
                {"id": 5, "answer": "犠牲にして", "accepted": ["犠牲にして", "実験台にして"]},
            ],
            distractors=["視力", "繁殖能力そのもの", "投票", "解放して", "訓練して"],
        ),
    },
}

# ---------------------------------------------------------------------------
# 2025-3
# ---------------------------------------------------------------------------

ROUND_2025_3 = {
    "1": {
        "paragraphs": [
            para(
                "In order to satisfy global food demand, hundreds of millions of tons of wheat, corn, and other crops are produced annually worldwide. This level of production has only been achieved through modern agriculture's increasing reliance on chemical pesticides to protect crops from insects that feed on plants and microbial pathogens such as bacteria and fungi. These pests can impair plant growth and lead to significantly reduced crop yields. Pesticides have made large-scale crop production possible, but some are also known to harm the environment or pose risks to human health. Pests also develop resistance to pesticides, especially when the pesticides are used in large amounts, so researchers are constantly looking for alternative crop-protection methods.",
                "世界の食料需要を満たすため、毎年、小麦やトウモロコシなどの作物が世界中で数億トンも生産されている。この生産量は、植物を食べる昆虫や、細菌・カビといった微生物病原体から作物を守るために、現代農業が化学農薬への依存を強めてきたことで初めて達成されたものである。これらの害虫・病原体は植物の成長を妨げ、収穫量を大幅に減少させることがある。農薬は大規模な作物生産を可能にしてきたが、一部の農薬は環境に害を与えたり、人間の健康にリスクをもたらしたりすることも知られている。また害虫は、特に農薬が大量に使われる場合、農薬への耐性を持つようになるため、研究者たちは絶えず代替の作物保護方法を探し続けている。",
            ),
            para(
                "A promising new approach to crop protection is the concept of induced resistance. This works by activating plants' natural defenses, which range from destroying pathogen-infected cells to releasing toxins to kill insects. Induced resistance can be achieved through a process known as defense priming, which involves applying stress to plants to stimulate a weak defense response. This prepares the plants to recognize and react strongly to threats in the future. Essentially, this \"vaccinates\" plants against pests in much the same way as human vaccines protect people against diseases such as influenza. Unlike most human vaccines, however, this method can protect plants against several pests at the same time. Furthermore, researchers have found that the protection can even be carried into the next generation, although the genetic mechanism by which this occurs has yet to be determined.",
                "作物保護に対する有望な新しいアプローチが、誘導抵抗性という概念である。これは、病原体に感染した細胞を破壊することから、昆虫を殺す毒素を放出することまで多岐にわたる、植物本来の防御機構を活性化させることによって働く。誘導抵抗性は、防御プライミングと呼ばれる過程を通じて実現できる。これは植物にストレスを与えて弱い防御反応を刺激するというものである。これにより、植物は将来の脅威を認識し、それに対して強く反応する準備ができる。要するに、これは人間のワクチンがインフルエンザのような病気から人を守るのとほぼ同じやり方で、植物を害虫から「ワクチン接種」するようなものである。しかし、ほとんどの人間用ワクチンとは異なり、この方法は複数の害虫から植物を同時に守ることができる。さらに研究者たちは、この防御効果が次世代にまで受け継がれる場合があることを発見しているが、それがどのような遺伝的しくみで起こるのかはまだ解明されていない。",
            ),
            para(
                "Induced resistance is considered to be very promising, but researchers caution that it has limitations. One is that diverting plants' resources toward defense can lead to reduced growth, which affects crop yields. Also, while induced resistance provides broader protection than most human vaccines, it cannot totally protect the plants. According to one biologist, \"Induced resistance is the result of a complex network of developmental and environmental pathways in the plant.\" She pointed out that using induced resistance effectively was not as simple as introducing a gene for a specific characteristic or using a pesticide with a particular action. She added that many aspects needed to be just right for this method to work, including the growing conditions and agricultural methods used. However, there is hope that when combined with other forms of natural crop protection, induced resistance can help minimize the need for pesticides and make agriculture more sustainable.",
                "誘導抵抗性は非常に有望だと考えられているが、研究者たちはそれに限界があると注意を促している。一つは、防御に資源を振り向けることで植物の成長が鈍り、収穫量に影響しうるという点である。また、誘導抵抗性はほとんどの人間用ワクチンより広い範囲を保護するとはいえ、植物を完全に守ることはできない。ある生物学者によれば、「誘導抵抗性は、植物内部の発生的・環境的な経路が複雑に絡み合ったネットワークの結果である」という。彼女は、誘導抵抗性を効果的に用いることは、特定の形質のための遺伝子を導入したり、特定の作用を持つ農薬を使ったりするほど単純ではないと指摘した。さらに、栽培条件や用いる農法など、この方法がうまく機能するためには多くの要素がちょうどよく揃っている必要があると付け加えた。しかし、他の自然な作物保護の方法と組み合わせることで、誘導抵抗性が農薬への依存を減らし、農業をより持続可能にする助けとなることが期待されている。",
            ),
        ],
        "questions": [
            question(25, 0, [3, 4], "第1段落では、農薬が大規模生産を可能にした一方で環境や健康へのリスクもあること、そのため研究者が代替の作物保護方法を絶えず探していることが述べられている。選択肢2はこの内容と一致する。",
                     "第1段落に基づくと、次のうちどれが正しいか。\n1 化学農薬が広く使われているにもかかわらず、現代農業は世界の人口を養うのに十分な作物を生産できていない。\n2 農薬は研究により人体に安全であることが示されているが、その悪いイメージのために使用が制限されてきた。\n3 農薬が食料生産に果たしてきた肯定的な役割はあるものの、科学者たちは作物を守る別の方法を模索している。\n4 農薬は害虫による被害を減らす効果的な方法だが、収穫量の減少につながることもある。"),
            question(26, 1, [4, 5], "第2段落では、誘導抵抗性は人間のワクチンと同じように植物を病害虫から守る一方、複数の害虫に同時に効くという点で人間のワクチンより広い効果を持つと述べられている。選択肢2が一致する。",
                     "この文章の著者によれば、誘導抵抗性は\n1 植物細胞に侵入する病原体を殺すことには効果を示してきたが、昆虫やその他の外部からの害虫から植物を守ることはできない。\n2 人間のワクチンが働くのとよく似た方法で植物が害虫から身を守るのを助けるが、その効果はより広範囲に及ぶ。\n3 人間にとってのワクチンと同様に植物の一生の間効果が続くが、遺伝的な基盤がないため子孫には受け継がれない。\n4 多くの場合うまく機能するが、植物に与えるストレスが原因で植物を傷つけることもある。"),
            question(27, 2, [3, 5], "ある生物学者は、誘導抵抗性は植物内の発生的・環境的経路が複雑に絡み合った結果であり、栽培条件や農法など多くの要素がうまく揃わなければ効果的に機能しないと述べている。選択肢3が一致する。",
                     "ある生物学者は誘導抵抗性について何と述べたか。\n1 研究者たちがまだ実際の畑でそれが機能することを証明できていないため、さらなる研究が必要である。\n2 他の種類の自然な作物保護方法への切り替えの試みがうまくいっていないため、それを使うことに消極的である。\n3 複雑な過程であるため、それを成功させるには多くの要素を慎重に調整する必要がある。\n4 農薬の使用と組み合わせて初めて効果を発揮するため、長期的には農業を持続可能にすることはできない。"),
        ],
        "summary": summary(
            sections=[
                {"label": "¶1 農薬への依存とその課題", "lines": [
                    ["農薬は大規模生産を可能にした一方、", {"blank": 1}, "や健康へのリスクもある。"],
                    ["害虫が", {"blank": 2}, "を持つようになることも問題である。"],
                ]},
                {"label": "¶2 誘導抵抗性のしくみ", "lines": [
                    ["誘導抵抗性は、植物本来の", {"blank": 3}, "を活性化させる方法である。"],
                    ["人間の", {"blank": 4}, "と似た働きをするが、複数の害虫に同時に効く点で異なる。"],
                ]},
                {"label": "¶3 限界と課題", "lines": [
                    ["防御に資源を割くことで", {"blank": 5}, "が鈍る可能性がある。"],
                    ["効果的に働かせるには、", {"blank": 6}, "など多くの要素が揃う必要がある。"],
                ]},
            ],
            blanks=[
                {"id": 1, "answer": "環境", "accepted": ["環境", "環境への害"]},
                {"id": 2, "answer": "耐性", "accepted": ["耐性", "農薬への耐性"]},
                {"id": 3, "answer": "防御機構", "accepted": ["防御機構", "防御反応"]},
                {"id": 4, "answer": "ワクチン", "accepted": ["ワクチン", "予防接種"]},
                {"id": 5, "answer": "成長", "accepted": ["成長", "植物の成長"]},
                {"id": 6, "answer": "栽培条件", "accepted": ["栽培条件", "栽培条件や農法"]},
            ],
            distractors=["収穫量", "遺伝子組み換え", "土壌の酸性度", "輸送コスト", "気候変動"],
        ),
    },
    "2": {
        "paragraphs": [
            para(
                "On May 3, 1886, at least two striking workers were killed by the police at a demonstration in Chicago. Angered by the deaths, labor rights activists organized a gathering for the next day at Haymarket Square. Many thousands of flyers printed not only in English but also in German for German-speaking immigrant workers were distributed. On May 4, a few thousand people attended, one of them being the Chicago mayor there to ensure the protest passed peacefully. For the most part, it did just that. Convinced that all was in order, he left early. However, as the event came to a close with passionate speeches, violence erupted when the police tried to break it up. Someone threw a homemade dynamite bomb, and in the following chaos, guns were fired. A number of police officers and attendees were killed.",
                "1886年5月3日、シカゴでのデモにおいて、少なくとも2人のストライキ参加労働者が警察によって殺害された。この死に憤った労働者の権利活動家たちは、翌日ヘイマーケット広場での集会を計画した。英語だけでなく、ドイツ語を話す移民労働者のためにドイツ語でも印刷された何千枚ものビラが配布された。5月4日には数千人が参加し、その中にはデモが平和的に終わるよう見届けるためにシカゴ市長も来ていた。ほとんどの場合、実際にそうなった。すべて順調だと確信した市長は早めに会場を後にした。しかし、集会が熱のこもった演説とともに終わりに近づいたとき、警察が解散させようとしたことで暴力が発生した。何者かが手製のダイナマイト爆弾を投げ、その後の混乱の中で銃が発砲された。多数の警官と参加者が死亡した。",
            ),
            para(
                "The Haymarket Affair, as the incident and its aftermath are often called, did not occur in a vacuum. Industrialization had increased in the nineteenth century. Chicago became a center for activists concerned about workers' rights in factories, shipyards, and mills. Some pro-worker groups were radical, some were socialist, while others were less politically oriented. They all, however, wanted protection for workers against what they saw as profit-seeking employers intent on exploiting workers. While issues such as child labor and low wages were all worthy of attention, the movement's main rallying cry was a demand to limit working hours to eight a day. The state of Illinois had introduced legislation in the 1860s that was intended to do that. However, according to Professor William J. Adelman, one obstacle to its success was a lack of strict enforcement. This gave employers room to force employees often poor immigrants to sign contracts agreeing to longer working days.",
                "ヘイマーケット事件——この事件とその後の経緯はしばしばこう呼ばれる——は、何もないところから突然起こったわけではない。19世紀には工業化が進んでいた。シカゴは、工場・造船所・製粉所における労働者の権利を懸念する活動家たちの中心地となっていた。労働者寄りの団体の中には過激なものもあれば、社会主義的なもの、あるいはさほど政治色の強くないものもあった。しかしいずれの団体も、労働者を搾取しようとする、利益優先の雇用者と彼らがみなす存在から、労働者を守ることを望んでいた。児童労働や低賃金といった問題もすべて注目に値するものではあったが、この運動の主要な訴えは、労働時間を1日8時間に制限することであった。イリノイ州は1860年代に、それを目的とした法律を導入していた。しかしウィリアム・J・アデルマン教授によれば、その法律が成功しなかった一因は、厳格な取り締まりの欠如にあった。このため雇用者は、しばしば貧しい移民である従業員に、より長い労働時間に同意する契約書へ署名するよう強いる余地を得ていた。",
            ),
            para(
                "The May 4 incident provoked a strong response from some newspapers, which whipped up public anger and claimed further bombings were planned. The authorities, who felt compelled to act, detained well-known radicals. Eight men were charged in connection with the bombing, and in August, the jury returned with its verdict: guilty. Even though there were concerns about jury bias, a lack of evidence, and the fact that some of the defendants had not even attended the Haymarket gathering, most of the men were given the death penalty. Four of them were hanged the following year. According to Adelman, the trial ranked as \"one of the most notorious in American history.\"",
                "5月4日の事件は一部の新聞に強い反応を引き起こし、それらの新聞は世論の怒りをあおり、さらなる爆破が計画されていると主張した。行動を起こさざるを得ないと感じた当局は、著名な急進派の人々を拘束した。8人の男が爆破事件に関与したとして起訴され、8月に陪審は有罪という評決を下した。陪審の偏り、証拠の不足、さらに被告の一部はヘイマーケットの集会に出席してすらいなかったという事実への懸念があったにもかかわらず、被告の大半に死刑が言い渡された。そのうち4人は翌年に絞首刑に処された。アデルマンによれば、この裁判は「アメリカ史上最も悪名高い裁判の一つ」であった。",
            ),
            para(
                "In the early 1890s, the governor of Illinois reviewed the court proceedings and documents, and he concluded that the trial had been unfair. The surviving men were pardoned and released from prison, a decision that was condemned by some industrialists and sections of the media. Although the governor's ruling came too late for those men who had lost their lives, the Haymarket Affair exposed the social and economic divisions that were commonplace at the time and became a symbol for many modern-day labor leaders and activists. Change did not come quickly, but the incident and its aftermath contributed to important labor reforms and greater recognition of workers' rights.",
                "1890年代初頭、イリノイ州知事は裁判記録と関連文書を見直し、この裁判は不当であったと結論づけた。生存していた被告たちは恩赦を受け、刑務所から釈放されたが、この決定は一部の実業家やメディアから非難された。この知事の裁定は、すでに命を落としていた人々にとっては手遅れだったものの、ヘイマーケット事件は当時ありふれていた社会的・経済的な分断をあらわにし、現代の多くの労働運動指導者や活動家にとっての象徴となった。変化はすぐには訪れなかったが、この事件とその後の展開は、重要な労働改革と労働者の権利へのより大きな認知に寄与した。",
            ),
        ],
        "questions": [
            question(28, 0, [4, 5], "第1段落では、集会がほとんど平穏に進んだため、市長はすべて順調だと確信して早めに退出したと述べられている。選択肢4はこの内容と一致する。",
                     "この文章によれば、シカゴ市長は\n1 前日のデモにいた警察官が、ヘイマーケットでの集会には勤務しないよう手配した。\n2 これほど重要な出来事への参加者数が、5月4日に実際に集まった人数よりも多くなることを望んでいた。\n3 終盤の演説が熱を帯びるにつれ、警察に実力行使で集会を終わらせる許可を与えるほかないと悟った。\n4 手続きがおおむね何事もなく進んだため、抗議活動の残り時間に大きな問題が起こる可能性は低いと考えていた。"),
            question(29, 1, [7, 8], "アデルマン教授は、労働時間を制限する法律が成功しなかった一因は厳格な取り締まりの欠如にあり、そのため雇用者が従業員により長い労働を強いる余地を得たと述べている。選択肢4がこれと一致する。",
                     "第2段落でウィリアム・J・アデルマン教授が示した意見を最もよく表しているのはどれか。\n1 雇用者は利益を重視していたため、とりわけ社会主義的な傾向を持つ労働者権利団体を支持することを期待するのは筋違いだった。\n2 州が児童労働の防止に重点を置いていれば、労働時間の制限よりも立法の取り組みはうまくいっていただろう。\n3 移民労働者は他の労働者より長時間働くことをいとわなかったため、法律を通過させられなかった責任を負わされた。\n4 イリノイ州が定めた労働時間を制限する法律は、企業に順守を強制する仕組みがなかったために機能しなかった。"),
            question(30, 2, [1, 3], "第3段落では、当局が行動せざるを得ないと感じて急進派を拘束したこと、陪審の偏りや証拠不足への懸念があったにもかかわらず、被告の大半に死刑が科されたことが述べられている。選択肢1がこの内容と一致する。",
                     "この文章の著者は、裁判をめぐる出来事について何を示唆しているか。\n1 被告が爆破事件に直接関与していたかどうかについて疑問が生じていたにもかかわらず、人々を逮捕し裁判を終結させることへのかなりの圧力があった。\n2 アデルマンによる裁判手続きへの批判は、被告たちが他のデモでも爆弾攻撃を計画していたという事実を考慮していない。\n3 逮捕された者たちはおそらく無実だったが、5月4日に多くの死者が出たことを考えれば、警察の行動は正当化される。\n4 一部の被告は他の被告よりも爆破事件に直接関与していたため、判決に差をつけた裁判所の判断は正しかった。"),
            question(31, 3, [2, 3], "第4段落では、ヘイマーケット事件が現代の労働運動指導者や活動家にとっての象徴となり、重要な労働改革と労働者の権利へのより大きな認知に寄与したと述べられている。選択肢3がこの内容と一致する。",
                     "ヘイマーケット事件が重要だとみなされる理由の一つは何か。\n1 力を持つ実業家たちが、労働法に違反した企業への罰則を軽くするよう裁判所に影響を与えることを許すべきではないという教訓を示している。\n2 メディアが労働争議を不正確に伝えることがある一方で、メディアには自らの誤りを正す力もあることを示すために使われる。\n3 最終的に権利を持たなかった人々の状況改善に役立ったという点で、労働運動史における転換点とみなされている。\n4 多くの活動家の努力にもかかわらず、社会的・経済的な分断のほとんどは常に残り続けるということを証明した。"),
        ],
        "summary": summary(
            sections=[
                {"label": "¶1 事件の発端", "lines": [
                    ["デモでストライキ参加労働者が", {"blank": 1}, "され、翌日の集会で", {"blank": 2}, "が起きた。"],
                ]},
                {"label": "¶2 運動の背景", "lines": [
                    ["労働運動の主な訴えは、", {"blank": 3}, "ことだった。"],
                    ["関連法があったが、", {"blank": 4}, "のため実効性がなかった。"],
                ]},
                {"label": "¶3 裁判", "lines": [
                    ["8人が起訴され、", {"blank": 5}, "への懸念があったにもかかわらず、大半に", {"blank": 6}, "が科された。"],
                ]},
                {"label": "¶4 その後", "lines": [
                    ["後にイリノイ州知事は裁判が", {"blank": 7}, "と結論づけ、生存者を釈放した。"],
                    ["この事件はその後の", {"blank": 8}, "や労働者の権利意識の高まりに寄与した。"],
                ]},
            ],
            blanks=[
                {"id": 1, "answer": "警察に殺害", "accepted": ["警察に殺害", "警察により殺害"]},
                {"id": 2, "answer": "爆弾テロ(爆発と発砲)", "accepted": ["爆弾テロ", "爆発と発砲", "爆弾が投げられ発砲が起きたこと"]},
                {"id": 3, "answer": "労働時間を1日8時間に制限する", "accepted": ["労働時間を1日8時間に制限する", "1日8時間労働にする"]},
                {"id": 4, "answer": "厳格な取り締まりの欠如", "accepted": ["厳格な取り締まりの欠如", "取り締まりが厳格でなかったこと"]},
                {"id": 5, "answer": "陪審の偏りや証拠不足", "accepted": ["陪審の偏りや証拠不足", "証拠不足"]},
                {"id": 6, "answer": "死刑", "accepted": ["死刑", "死刑判決"]},
                {"id": 7, "answer": "不当だった", "accepted": ["不当だった", "不公正だった"]},
                {"id": 8, "answer": "労働改革", "accepted": ["労働改革", "労働法の改革"]},
            ],
            distractors=["賃上げ", "移民の受け入れ制限", "無罪", "工場の閉鎖", "選挙制度の改革"],
        ),
    },
}

# ---------------------------------------------------------------------------
# 2025-2
# ---------------------------------------------------------------------------

ROUND_2025_2 = {
    "1": {
        "paragraphs": [
            para(
                "Some US astronauts became household names in the 1950s and '60s, partly due to the media coverage of their achievements. Behind the scenes, however, others played a crucial role in making US space missions, including the moon landing, successful. Unlike the astronauts, many of these unsung heroes were female. These women, who came to be called human computers, conducted complex calculations in areas such as spacecraft navigation, rocket aerodynamics, and orbital physics. The human computers' calculations, mostly done by hand, were mentally and physically demanding, sometimes each taking a week to complete. Without them, it would have been impossible to launch spacecraft, and any inaccuracies could have had life-threatening consequences for the astronauts.",
                "一部のアメリカ人宇宙飛行士は、その功績がメディアで報じられたこともあって、1950年代から60年代にかけて誰もが知る名前になった。しかし舞台裏では、月面着陸を含むアメリカの宇宙ミッションを成功させるうえで、他の人々が重要な役割を果たしていた。宇宙飛行士とは異なり、こうした陰の立役者の多くは女性だった。「ヒューマン・コンピューター」と呼ばれるようになったこれらの女性たちは、宇宙船の航法、ロケットの空気力学、軌道力学といった分野で複雑な計算を行っていた。ヒューマン・コンピューターたちの計算は、その大半が手作業で行われ、精神的にも肉体的にも過酷なもので、1件につき1週間かかることもあった。彼女たちがいなければ、宇宙船の打ち上げは不可能だっただろうし、わずかな誤りが宇宙飛行士の命に関わる結果を招きかねなかった。",
            ),
            para(
                "The women were standing on the shoulders of others who had gone before them. As fields such as astronomy, navigation, and surveying expanded in the nineteenth century, so did the need for mathematical computation. This need only skyrocketed in World War I and World War II. Early computation work had been mainly undertaken by men. However, partly due to the discriminatory nature of contemporary societal norms, employing women meant that salaries and therefore overall costs could be dramatically reduced. Gradually, these jobs came to be seen by some as \"women's work.\" Historian Mar Hicks believes that one reason these \"pre-electronic computation jobs were feminized is they were seen as rote and de-skilled.\" Although human-computer work was sometimes repetitive, Hicks points out that it often required advanced math skills.",
                "こうした女性たちは、先人たちの築いた土台の上に立っていた。19世紀に天文学、航法、測量といった分野が発展するにつれ、数学的な計算に対する需要も高まっていった。この需要は第一次世界大戦と第二次世界大戦で急激に高まった。初期の計算業務は主に男性が担っていた。しかし、当時の社会規範が持つ差別的な性質もあって、女性を雇うことで給与、ひいては全体のコストを大幅に削減できた。次第に、こうした仕事は一部の人々から「女性の仕事」とみなされるようになった。歴史家のマー・ヒックスは、こうした「電子化以前の計算業務が女性の仕事とされた理由の一つは、それが単調で技能を要しない仕事とみなされたからだ」と考えている。ヒューマン・コンピューターの仕事は反復的なこともあったが、実際には高度な数学の技能を要することが多かったとヒックスは指摘する。",
            ),
            para(
                "Around the mid-twentieth century, when Cold War tensions with the Soviet Union escalated, the United States turned more of its attention to space. NASA's predecessor, NACA, employed many women to conduct calculations. The agency was seen as progressive in a few respects: women's pay was relatively high, some women were supervisors, and married women with children were employed. Nevertheless, women were not treated as equals. African American women faced an additional layer of discrimination as they were forced to conduct much of their work in segregated facilities. When NASA was established in 1958, it abolished that policy and also improved other conditions for women.",
                "20世紀半ば頃、ソ連との冷戦の緊張が高まる中、アメリカはより多くの関心を宇宙に向けるようになった。NASAの前身であるNACAは、計算業務を行うために多くの女性を雇用した。この機関はいくつかの点で進歩的だとみなされていた。女性の給与は比較的高く、女性の中には管理職に就く者もおり、子どものいる既婚女性も雇用されていた。それでも、女性が対等に扱われていたわけではなかった。アフリカ系アメリカ人の女性は、業務の多くを人種隔離された施設で行うことを強いられ、さらに一層の差別に直面していた。1958年にNASAが設立されると、この方針は廃止され、女性のための他の労働条件も改善された。",
            ),
            para(
                "Time, however, was not on the human computers' side. Space missions became more complex, and the transition to electronic computation negated the need for most human computers. Nonetheless, it was a while before electronic data would be wholly trusted: In the early 1960s, for example, astronaut John Glenn asked Katherine Johnson, an African American human computer, to personally verify computer-calculated orbital equations before he would fly.",
                "しかし、時間はヒューマン・コンピューターたちの味方ではなかった。宇宙ミッションはより複雑になり、電子計算への移行によって、ほとんどのヒューマン・コンピューターは不要になっていった。とはいえ、電子データが完全に信頼されるようになるまでにはしばらく時間がかかった。例えば1960年代初頭、宇宙飛行士ジョン・グレンは、飛行の前に、アフリカ系アメリカ人のヒューマン・コンピューターであるキャサリン・ジョンソンに、コンピューターが計算した軌道方程式を自分で検算するよう依頼している。",
            ),
        ],
        "questions": [
            question(25, 0, [4, 5], "第1段落では、ヒューマン・コンピューターの計算が非常に過酷な作業であり、彼女たちがいなければ宇宙船の打ち上げは不可能で、誤りは命に関わりかねなかったと述べられている。選択肢4はこの内容と一致する。",
                     "この文章の著者は、1950年代・60年代のアメリカの宇宙ミッションについて何と述べているか。\n1 宇宙飛行の身体的な負担を考えると、女性ではなく男性が宇宙に送られたのは理解できることだった。\n2 ミッションは、ヒューマン・コンピューターの計算に頼るには重要すぎるとみなされていた。\n3 当時の宇宙飛行士たちは、ミッションに携わった女性たちの働きにメディアがもっと光を当てるべきだと感じていた。\n4 ミッションは、ヒューマン・コンピューターによる正確な計算があったからこそ、有効に成し遂げることができた。"),
            question(26, 1, [6, 7], "第2段落では、計算業務が単調で技能を要しない仕事とみなされていた一方、実際には高度な数学の技能を要することが多かったとヒックスが指摘している。これは、計算業務が女性向きだという見方がその仕事の実態への誤解に基づいていたことを示しており、選択肢1と一致する。",
                     "マー・ヒックスが最も同意しそうなのは、次のうちどの記述か。\n1 計算業務が女性のためのものだという見方は、その仕事の実態に対する誤解に一部起因していた。\n2 戦間期には、雇用された女性たちが必要な数学の技能を欠いていることもあったため、男性数学者が依然として重要な役割を果たしていた。\n3 女性に低賃金を払うことでコストを削減したことは、最終的にデータの信頼性全体に悪影響を及ぼした。\n4 二度の世界大戦は、男性よりも女性にはるかに大きな恩恵をもたらす社会変化を引き起こした。"),
            question(27, 2, [4, 5], "第3段落では、アフリカ系アメリカ人の女性が隔離施設での勤務を強いられるなど一層の差別に直面していたが、NASA設立後にはその方針が廃止され、女性の労働条件が改善されたと述べられている。選択肢2がこの内容と一致する。",
                     "この文章の著者は、NASAが設立された後、\n1 冷戦の焦点は宇宙関連のミッションを行うことから徐々に離れていったと指摘している。\n2 一部のヒューマン・コンピューターが経験していた不公平のいくつかに対処する取り組みを行ったと指摘している。\n3 女性の管理職には、これまでの低い給与を埋め合わせるための追加の報酬が与えられたと指摘している。\n4 宇宙開発競争に勝つには、ソ連のヒューマン・コンピューターの一部を採用する必要があると悟ったと指摘している。"),
        ],
        "summary": summary(
            sections=[
                {"label": "¶1 ヒューマン・コンピューターの役割", "lines": [
                    ["女性たちは", {"blank": 1}, "で複雑な計算を行い、", {"blank": 2}, "を支えた。"],
                ]},
                {"label": "¶2 女性が計算業務を担った背景", "lines": [
                    ["女性を雇うことで", {"blank": 3}, "でき、「女性の仕事」とみなされた。"],
                    ["しかし実際には", {"blank": 4}, "を要する仕事だった。"],
                ]},
                {"label": "¶3-4 NASAでの扱いとその後", "lines": [
                    ["アフリカ系アメリカ人女性は", {"blank": 5}, "での勤務を強いられていたが、NASA設立後に", {"blank": 6}, "された。"],
                    ["その後、", {"blank": 7}, "への移行で人間による計算の必要性は薄れていった。"],
                ]},
            ],
            blanks=[
                {"id": 1, "answer": "手作業", "accepted": ["手作業", "手計算"]},
                {"id": 2, "answer": "宇宙ミッション", "accepted": ["宇宙ミッション", "宇宙船の打ち上げ"]},
                {"id": 3, "answer": "コストを削減", "accepted": ["コストを削減", "全体のコストを大幅に削減"]},
                {"id": 4, "answer": "高度な数学の技能", "accepted": ["高度な数学の技能", "高度な数学力"]},
                {"id": 5, "answer": "人種隔離された施設", "accepted": ["人種隔離された施設", "隔離された施設"]},
                {"id": 6, "answer": "その方針が廃止", "accepted": ["その方針が廃止", "方針が撤廃"]},
                {"id": 7, "answer": "電子計算", "accepted": ["電子計算", "コンピューターによる計算"]},
            ],
            distractors=["昇進試験", "無償労働", "国外への移住", "男女の給与格差の拡大", "労働組合の結成"],
        ),
    },
    "2": {
        "paragraphs": [
            para(
                "It was once thought that the use of medicine was a uniquely human trait, but over the past fifty years or so, scientists have reported many cases of animals using natural remedies to self-medicate. Plants produce many chemical substances to protect themselves against disease or prevent themselves from being eaten by animals and insects, and some of these chemicals have medicinal properties. A growing body of research shows that animals have learned to recognize and consume these substances to treat and prevent illnesses.",
                "かつて、薬を使うことは人間だけに見られる特性だと考えられていたが、この50年ほどの間に、科学者たちは動物が自然の治療法を用いて自己治療(セルフメディケーション)を行う事例を数多く報告してきた。植物は、病気から身を守ったり、動物や昆虫に食べられるのを防いだりするために多くの化学物質を作り出しており、こうした化学物質の一部には薬効がある。研究の蓄積が増えるにつれ、動物がこうした物質を認識し摂取することを学び、病気の治療や予防に役立ててきたことが明らかになりつつある。",
            ),
            para(
                "Self-medication by animals was first recorded in the 1970s by researchers studying a group of chimpanzees in Tanzania. They observed some chimpanzees in the group swallowing the leaves of plants that were not a part of their regular diet. Since the chimpanzees were swallowing the leaves whole without chewing them, they were obviously not consuming them for nutritional purposes, and further observations revealed that the behavior occurred more frequently when stomach parasites were common among the group. The researchers hypothesized that the leaves were being used to remove the parasites, and they used the term \"zoopharmacognosy\" to refer to this self-medicating behavior.",
                "動物によるセルフメディケーションが初めて記録されたのは1970年代、タンザニアのチンパンジーの群れを研究していた研究者たちによってであった。彼らは、群れの中の一部のチンパンジーが、普段の食事には含まれない植物の葉を飲み込んでいるのを観察した。チンパンジーはその葉を噛まずに丸のみしていたため、明らかに栄養目的で摂取しているのではなく、さらなる観察により、群れの中で胃の寄生虫が多く見られる時期にこの行動がより頻繁に起こることが分かった。研究者たちは、その葉が寄生虫を排除するために使われているのではないかと仮説を立て、このようなセルフメディケーション行動を指して「動物薬理学(zoopharmacognosy)」という語を用いた。",
            ),
            para(
                "For many years, it was believed by most scientists that this behavior was limited to animals with advanced intellectual ability. This belief originated mainly from the initial observations of chimpanzees, which suggested that the behavior had to be learned and passed on from generation to generation. However, a recent review of research has shown that self-medication is much more common than was previously thought and is even demonstrated by some insects. This suggests that self-medication must also occur by instinct, and many scientists now believe that it can be both innate and learned, even in more intelligent animals.",
                "長年にわたり、ほとんどの科学者は、この行動は高度な知的能力を持つ動物に限られると考えていた。この考えは主に、チンパンジーに関する初期の観察に由来しており、その行動は学習され世代を超えて受け継がれなければならないことを示唆していた。しかし近年の研究の見直しにより、セルフメディケーションはこれまで考えられていたよりもはるかに一般的で、一部の昆虫にも見られることが明らかになった。これは、セルフメディケーションが本能によっても起こりうることを示唆しており、多くの科学者は今では、より知能の高い動物においてさえ、それが本能的なものと学習によるものの両方でありうると考えている。",
            ),
            para(
                "One of the best-studied examples of self-medication in insects is that of fruit flies. These tiny flies are often targeted by a type of parasitic wasp that lays its eggs inside the flies' bodies. Research has shown that fruit flies infected by parasitic wasps deliberately consume food containing alcohol, such as rotting fruit. The alcohol prevents the development of the wasp larvae and protects the flies. Consuming food with high alcohol content is normally harmful to the flies, so they avoid doing so when they are healthy. This implies that something triggers them to seek out such food only when they have wasp larvae inside them, and scientists seem to have determined the chemical compound that causes it. In other studies, it has also been found that the use of natural medication by some social insects goes beyond self-medication. When bacterial and fungal infections occur within an ant colony, for example, the insects collect resin from nearby trees and take it back to the colony. The resin has antibacterial and antifungal properties, so by doing this, the ants are performing a form of \"social medication.\"",
                "昆虫のセルフメディケーションの中で最もよく研究されている例の一つが、ショウジョウバエのものである。この小さなハエは、体内に卵を産みつける一種の寄生バチにしばしば狙われる。研究により、寄生バチに感染したショウジョウバエは、腐った果実などアルコールを含む食物を意図的に摂取することが示されている。アルコールは寄生バチの幼虫の発育を妨げ、ハエを守る。アルコール含有量の高い食物を摂取することは通常ハエにとって有害であるため、健康なときにはそれを避ける。このことは、体内に寄生バチの幼虫がいるときにだけ、何かがハエにそうした食物を求めるよう仕向けていることを示唆しており、科学者たちはその引き金となる化学物質を突き止めたようである。また別の研究では、一部の社会性昆虫による自然の薬の利用が、自己治療の域を超えていることも分かっている。例えば、アリのコロニー内で細菌感染や真菌感染が発生すると、アリは近くの木から樹脂を集めてコロニーに持ち帰る。この樹脂には抗菌・抗真菌性があるため、こうすることでアリは一種の「社会的な薬の利用」を行っていることになる。",
            ),
            para(
                "Many scientists believe it is likely that our human ancestors gained knowledge of medicinal plants by observing the behavior of animals. They also hope that further research into zoopharmacognosy will help to improve human health care by providing clues to new sources of medicines.",
                "多くの科学者は、私たちヒトの祖先も動物の行動を観察することで薬効のある植物についての知識を得た可能性が高いと考えている。また彼らは、動物薬理学のさらなる研究が、新たな薬の源についての手がかりを提供することで、人間の医療の向上に役立つことを期待している。",
            ),
        ],
        "questions": [
            question(28, 1, [2, 3], "第2段落では、群れの中で胃の寄生虫が多い時期にチンパンジーが葉を飲み込む行動がより頻繁に見られ、研究者たちはこの葉が寄生虫を排除するために使われているのではないかと仮説を立てたと述べられている。選択肢4がこの内容と一致する。",
                     "1970年代のある研究者グループはどのような結論に達したか。\n1 動物が薬効のある天然物質を利用しているという報告例の大半は誤りだった。\n2 植物が作り出す化学物質のほとんどは、少量摂取しただけでも動物にとって有害だった。\n3 チンパンジーは、通常の食物源から十分な栄養を得られないとき、葉を食事に補助的に取り入れていた。\n4 チンパンジーは、寄生虫感染に苦しんでいるとき、特定の植物の葉を意図的に食べていた。"),
            question(29, 2, [0, 1], "第3段落では、この行動は学習され世代を超えて受け継がれなければならないと考えられていたことから、高度な知的能力を持つ動物に限られると長年信じられていたと述べられている。選択肢3がこの内容と一致する。",
                     "ほとんどの科学者が長年信じていたことは何か。\n1 未知の物質を摂取することは動物本来の本能に反するため、動物はセルフメディケーションを行わない。\n2 動物が薬効目的で利用する植物の種類は、世代ごとに変化していく。\n3 知能の低い動物は、その方法を学ぶ能力を欠いているため、セルフメディケーションを行うことができない。\n4 すべての動物は、薬効を持つ天然物質を認識する能力を生まれながらに備えている。"),
            question(30, 3, [3, 4], "第4段落では、アルコールを含む食物の摂取は通常ハエにとって有害だが、寄生バチに感染した場合には幼虫の発育を妨げ、ハエを守る効果があると述べられている。選択肢1がこの内容と一致する。",
                     "この文章の著者がショウジョウバエについて述べていることの一つは何か。\n1 アルコールの摂取は健康には害を与えるが、寄生バチに感染しているときには全体として有益に働く。\n2 アルコールを含む食物の摂取はハエを弱らせ、寄生バチに対してより無防備にする。\n3 ハエは、アルコールの有害な影響を減らすために、意図的に寄生バチに感染する。\n4 ハエは、寄生バチが体内に卵を産みつけるのを防ぐ方法を発達させてきた。"),
            question(31, 3, [6, 8], "第4段落後半では、一部の社会性昆虫による自然の薬の利用が自己治療の域を超えており、アリがコロニー全体のために抗菌・抗真菌性のある樹脂を集める「社会的な薬の利用」を行っていると述べられている。選択肢3がこの内容と一致する。",
                     "研究により、一部の社会性昆虫は\n1 細菌感染や真菌感染から自分自身とコロニーを守る物質を作り出すことが示されている。\n2 感染症にかかったとき、感染が広がるのを防ぐためにコロニーを離れることが示されている。\n3 自分自身のためだけでなく、コロニー全体に利益をもたらす形で天然の薬を利用することが示されている。\n4 コロニーの他のメンバーに、細菌感染や真菌感染への対処法を教える能力を持つことが示されている。"),
        ],
        "summary": summary(
            sections=[
                {"label": "¶1-2 発見の経緯", "lines": [
                    ["動物による", {"blank": 1}, "は、タンザニアのチンパンジーの観察から発見された。"],
                    ["群れの中で", {"blank": 2}, "が多い時期に、葉を飲み込む行動が増えた。"],
                ]},
                {"label": "¶3 知能との関係", "lines": [
                    ["長年、この行動には", {"blank": 3}, "が必要だと考えられていた。"],
                    ["しかし近年、昆虫にも見られることから", {"blank": 4}, "の要素もあると分かってきた。"],
                ]},
                {"label": "¶4 ショウジョウバエとアリ", "lines": [
                    ["ショウジョウバエは、", {"blank": 5}, "に感染すると、あえてアルコールを含む食物を食べる。"],
                    ["アリは樹脂を集め、", {"blank": 6}, "のために利用する。"],
                ]},
            ],
            blanks=[
                {"id": 1, "answer": "自己治療(セルフメディケーション)", "accepted": ["自己治療", "セルフメディケーション"]},
                {"id": 2, "answer": "胃の寄生虫", "accepted": ["胃の寄生虫", "寄生虫"]},
                {"id": 3, "answer": "高度な知的能力", "accepted": ["高度な知的能力", "高い知能"]},
                {"id": 4, "answer": "本能", "accepted": ["本能", "本能的なもの"]},
                {"id": 5, "answer": "寄生バチ", "accepted": ["寄生バチ", "寄生バチの幼虫"]},
                {"id": 6, "answer": "コロニー全体", "accepted": ["コロニー全体", "コロニー全体の防御"]},
            ],
            distractors=["渡り鳥のルート", "冬眠", "巣の建材", "求愛行動", "気温の調節"],
        ),
    },
}
