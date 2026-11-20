package com.aurea.fit.domain

import com.aurea.fit.domain.Equipment.*
import com.aurea.fit.domain.Limitation.*
import com.aurea.fit.domain.Muscle.*

/** "Encaixe" do exercício dentro de um treino (usado pelo gerador). */
enum class Slot(val label: String) {
    HIP_THRUST("Extensão de quadril"), SQUAT("Agachamento"), LEG_PRESS("Leg press"), HINGE("Dobradiça de quadril"),
    LUNGE("Unilateral de pernas"), KNEE_FLEX("Flexão de joelhos"), KNEE_EXT("Extensão de joelhos"),
    ABDUCTION("Abdução de quadril"), KICKBACK("Coice / extensão de quadril"), CALF("Panturrilhas"), CORE("Core"),
    VERTICAL_PULL("Puxada vertical"), HORIZONTAL_PULL("Remada"), VERTICAL_PUSH("Desenvolvimento"),
    LATERAL_RAISE("Elevação lateral"), HORIZONTAL_PUSH("Empurrar (peito)"), BICEPS("Bíceps"), TRICEPS("Tríceps")
}

/** Tipo de animação demonstrativa desenhada pelo app (boneco animado). */
enum class Anim {
    SQUAT, HIP_THRUST, BRIDGE, HINGE, LEG_PRESS, LEG_EXTENSION, LEG_CURL_LYING, LEG_CURL_SEATED, LUNGE, STEP_UP,
    ABDUCTION_SEATED, ABDUCTION_STANDING, ABDUCTION_LYING, KICKBACK_STANDING, DONKEY_KICK, HYPEREXT,
    CALF_STANDING, CALF_SEATED, PLANK, SIDE_PLANK, CRUNCH, CABLE_CRUNCH, LEG_RAISE, DEAD_BUG, SUPERMAN,
    PULLDOWN, ROW_SEATED, ROW_BENT, SHOULDER_PRESS, LATERAL_RAISE, CHEST_PRESS, PRESS_SEATED, PUSHUP,
    CURL, PUSHDOWN, OVERHEAD_EXT, DIP
}

data class Exercise(
    val id: String,
    val name: String,
    val slot: Slot,
    val primary: Muscle,
    val secondary: List<Muscle>,
    val equipment: Set<Equipment>,
    val anim: Anim,
    val compound: Boolean,
    val avoidIf: Set<Limitation> = emptySet(),
    val minLevel: Experience = Experience.BEGINNER,
    val steps: List<String>,
    val tips: List<String>,
    val alternatives: List<String> = emptyList(),
    val timeBased: Boolean = false,
    val loadStep: Double = 2.5
) {
    val gymOnly: Boolean get() = MACHINES in equipment || CABLE in equipment
    val muscles: List<Muscle> get() = listOf(primary) + secondary
    val videoQuery: String get() = "$name execução correta"
}

object ExerciseLibrary {

    val all: List<Exercise> = listOf(
        // ---------------- EXTENSÃO DE QUADRIL (glúteo máximo) ----------------
        Exercise(
            "hip_thrust_barra", "Hip thrust com barra", Slot.HIP_THRUST, GLUTE_MAX, listOf(HAMSTRINGS, CORE),
            setOf(BARBELL, BENCH), Anim.HIP_THRUST, true,
            steps = listOf(
                "Sente no chão com a parte de baixo das escápulas apoiada na borda do banco.",
                "Coloque a barra (com protetor) sobre o quadril e os pés afastados na largura do quadril.",
                "Empurre o chão com os calcanhares e suba o quadril até o tronco ficar alinhado às coxas.",
                "Contraia os glúteos por 1 segundo no topo e desça com controle."
            ),
            tips = listOf(
                "Queixo levemente para baixo e costelas \"fechadas\": não arqueie a lombar no topo.",
                "No topo, as canelas devem ficar quase na vertical."
            ),
            alternatives = listOf("hip_thrust_halter", "hip_thrust_maquina", "elevacao_pelvica")
        ),
        Exercise(
            "hip_thrust_maquina", "Hip thrust na máquina", Slot.HIP_THRUST, GLUTE_MAX, listOf(HAMSTRINGS),
            setOf(MACHINES), Anim.HIP_THRUST, true,
            steps = listOf(
                "Ajuste o apoio das costas na altura das escápulas e o cinto/rolo sobre o quadril.",
                "Pés firmes na plataforma, afastados na largura do quadril.",
                "Estenda o quadril até alinhar tronco e coxas, contraindo os glúteos.",
                "Desça devagar até sentir alongar, sem relaxar totalmente."
            ),
            tips = listOf("Pense em \"empurrar com o calcanhar\".", "Evite hiperestender a lombar no final."),
            alternatives = listOf("hip_thrust_barra", "hip_thrust_halter", "elevacao_pelvica")
        ),
        Exercise(
            "hip_thrust_halter", "Hip thrust com halter", Slot.HIP_THRUST, GLUTE_MAX, listOf(HAMSTRINGS),
            setOf(DUMBBELLS, BENCH), Anim.HIP_THRUST, true,
            steps = listOf(
                "Apoie as escápulas num banco, sofá firme ou cama e segure um halter sobre o quadril.",
                "Pés no chão, joelhos dobrados a cerca de 90° no topo.",
                "Suba o quadril contraindo os glúteos até alinhar com o tronco.",
                "Desça controlando por 2 segundos."
            ),
            tips = listOf("Use uma toalha dobrada sob o halter para conforto.", "Mantenha o olhar à frente, não para o teto."),
            alternatives = listOf("elevacao_pelvica", "ponte_unilateral")
        ),
        Exercise(
            "elevacao_pelvica", "Elevação pélvica no chão (ponte de glúteo)", Slot.HIP_THRUST, GLUTE_MAX, listOf(HAMSTRINGS, CORE),
            setOf(BODYWEIGHT), Anim.BRIDGE, true,
            steps = listOf(
                "Deite de barriga para cima, joelhos dobrados e pés apoiados perto do quadril.",
                "Braços ao lado do corpo. Contraia o abdômen.",
                "Suba o quadril empurrando os calcanhares no chão até alinhar joelhos, quadril e ombros.",
                "Segure 2 segundos no topo e desça devagar."
            ),
            tips = listOf("Para dificultar: mini band acima dos joelhos ou um peso no quadril.", "Não empurre com a lombar: a força vem dos glúteos."),
            alternatives = listOf("ponte_unilateral", "hip_thrust_halter")
        ),
        Exercise(
            "ponte_unilateral", "Ponte de glúteo unilateral", Slot.HIP_THRUST, GLUTE_MAX, listOf(GLUTE_MED, HAMSTRINGS),
            setOf(BODYWEIGHT), Anim.BRIDGE, true, minLevel = Experience.INTERMEDIATE,
            steps = listOf(
                "Deite de barriga para cima com um pé apoiado e a outra perna estendida no ar.",
                "Empurre o calcanhar apoiado e suba o quadril sem girar a pelve.",
                "Contraia o glúteo no topo por 1 segundo.",
                "Desça com controle e complete as repetições antes de trocar o lado."
            ),
            tips = listOf("Mantenha o quadril nivelado (sem inclinar para um lado).", "Faça o lado mais fraco primeiro."),
            alternatives = listOf("elevacao_pelvica")
        ),

        // ---------------- AGACHAMENTOS ----------------
        Exercise(
            "agachamento_livre", "Agachamento livre com barra", Slot.SQUAT, QUADS, listOf(GLUTE_MAX, CORE),
            setOf(BARBELL), Anim.SQUAT, true, avoidIf = setOf(KNEE, LOWER_BACK), minLevel = Experience.INTERMEDIATE,
            steps = listOf(
                "Barra apoiada sobre o trapézio, pés na largura dos ombros e pontas levemente para fora.",
                "Inspire, contraia o abdômen e desça levando o quadril para trás e para baixo.",
                "Joelhos acompanham a direção das pontas dos pés.",
                "Desça até onde mantiver a coluna neutra e suba empurrando o chão."
            ),
            tips = listOf("Calcanhares sempre no chão.", "Não deixe os joelhos caírem para dentro."),
            alternatives = listOf("agachamento_smith", "agachamento_goblet", "agachamento_banco")
        ),
        Exercise(
            "agachamento_smith", "Agachamento no Smith", Slot.SQUAT, QUADS, listOf(GLUTE_MAX),
            setOf(MACHINES), Anim.SQUAT, true, avoidIf = setOf(KNEE),
            steps = listOf(
                "Posicione a barra do Smith sobre o trapézio e os pés um pouco à frente do corpo.",
                "Destrave a barra, contraia o abdômen e desça com controle.",
                "Desça até as coxas ficarem próximas da linha paralela ao chão (ou até onde estiver confortável).",
                "Suba empurrando o chão com o pé inteiro."
            ),
            tips = listOf("Pés mais à frente = mais glúteos; mais abaixo da barra = mais quadríceps.", "Trave a barra no final de cada série."),
            alternatives = listOf("agachamento_goblet", "leg_press_45")
        ),
        Exercise(
            "agachamento_goblet", "Agachamento goblet (halter no peito)", Slot.SQUAT, QUADS, listOf(GLUTE_MAX, CORE),
            setOf(DUMBBELLS), Anim.SQUAT, true,
            steps = listOf(
                "Segure um halter junto ao peito com as duas mãos.",
                "Pés um pouco além da largura do quadril, pontas levemente para fora.",
                "Desça mantendo o peito aberto e os cotovelos entre os joelhos.",
                "Suba empurrando o chão e contraindo os glúteos no final."
            ),
            tips = listOf("Ótimo exercício para aprender o agachamento.", "Se o calcanhar sair do chão, desça menos."),
            alternatives = listOf("agachamento_corpo", "agachamento_banco")
        ),
        Exercise(
            "agachamento_sumo", "Agachamento sumô com halter", Slot.SQUAT, GLUTE_MAX, listOf(QUADS, HAMSTRINGS),
            setOf(DUMBBELLS), Anim.SQUAT, true, avoidIf = setOf(HIP),
            steps = listOf(
                "Pés bem afastados e pontas viradas para fora, segurando um halter entre as pernas.",
                "Desça com o tronco ereto, abrindo os joelhos na direção dos pés.",
                "Desça até sentir alongar a parte interna da coxa.",
                "Suba contraindo glúteos."
            ),
            tips = listOf("Joelhos sempre apontando para os pés.", "Mantenha o peito aberto."),
            alternatives = listOf("agachamento_goblet", "agachamento_corpo")
        ),
        Exercise(
            "agachamento_banco", "Agachamento no banco (sentar e levantar)", Slot.SQUAT, QUADS, listOf(GLUTE_MAX),
            setOf(BODYWEIGHT, BENCH), Anim.SQUAT, true,
            steps = listOf(
                "Fique de costas para um banco ou cadeira firme, pés na largura do quadril.",
                "Leve o quadril para trás e desça até encostar levemente no banco.",
                "Sem relaxar no banco, levante empurrando o chão.",
                "Mantenha o peito aberto durante todo o movimento."
            ),
            tips = listOf("Excelente opção para iniciantes ou para quem sente o joelho.", "Segure um peso no peito para progredir."),
            alternatives = listOf("agachamento_corpo", "agachamento_goblet")
        ),
        Exercise(
            "agachamento_corpo", "Agachamento com peso do corpo", Slot.SQUAT, QUADS, listOf(GLUTE_MAX),
            setOf(BODYWEIGHT), Anim.SQUAT, true,
            steps = listOf(
                "Pés na largura dos ombros, braços à frente para equilíbrio.",
                "Desça levando o quadril para trás como se fosse sentar.",
                "Mantenha calcanhares no chão e joelhos alinhados com os pés.",
                "Suba contraindo os glúteos."
            ),
            tips = listOf("Faça a descida em 3 segundos para aumentar a dificuldade.", "Use uma mochila com peso para progredir."),
            alternatives = listOf("agachamento_banco")
        ),
        Exercise(
            "agachamento_hack", "Agachamento hack (máquina)", Slot.SQUAT, QUADS, listOf(GLUTE_MAX),
            setOf(MACHINES), Anim.SQUAT, true, avoidIf = setOf(KNEE), minLevel = Experience.INTERMEDIATE,
            steps = listOf(
                "Costas e ombros apoiados na máquina, pés no meio da plataforma.",
                "Destrave e desça com controle até cerca de 90° nos joelhos.",
                "Suba empurrando a plataforma com o pé inteiro.",
                "Não trave totalmente os joelhos no topo."
            ),
            tips = listOf("Pés mais altos enfatizam glúteos.", "Mantenha a lombar encostada."),
            alternatives = listOf("leg_press_45", "agachamento_smith")
        ),

        // ---------------- LEG PRESS ----------------
        Exercise(
            "leg_press_45", "Leg press 45°", Slot.LEG_PRESS, QUADS, listOf(GLUTE_MAX, HAMSTRINGS),
            setOf(MACHINES), Anim.LEG_PRESS, true,
            steps = listOf(
                "Sente com as costas e o quadril bem apoiados, pés no meio da plataforma.",
                "Destrave e desça a plataforma dobrando os joelhos em direção ao peito.",
                "Pare antes de o quadril sair do banco (a lombar não pode descolar).",
                "Empurre a plataforma sem travar os joelhos no final."
            ),
            tips = listOf("Joelhos alinhados com os pés.", "Amplitude confortável é mais importante que muita carga."),
            alternatives = listOf("agachamento_goblet", "agachamento_banco")
        ),
        Exercise(
            "leg_press_pes_altos", "Leg press com pés altos (ênfase glúteos)", Slot.LEG_PRESS, GLUTE_MAX, listOf(HAMSTRINGS, QUADS),
            setOf(MACHINES), Anim.LEG_PRESS, true,
            steps = listOf(
                "Posicione os pés na parte alta da plataforma, um pouco mais afastados.",
                "Desça a plataforma levando os joelhos em direção aos ombros.",
                "Empurre com os calcanhares, contraindo glúteos.",
                "Mantenha quadril e lombar apoiados."
            ),
            tips = listOf("Empurre com o calcanhar para sentir mais os glúteos.", "Desça devagar (2–3 s)."),
            alternatives = listOf("agachamento_sumo", "elevacao_pelvica")
        ),

        // ---------------- DOBRADIÇA DE QUADRIL ----------------
        Exercise(
            "stiff_barra", "Stiff com barra", Slot.HINGE, HAMSTRINGS, listOf(GLUTE_MAX, BACK),
            setOf(BARBELL), Anim.HINGE, true, avoidIf = setOf(LOWER_BACK),
            steps = listOf(
                "Em pé, barra na frente das coxas, pés na largura do quadril, joelhos levemente flexionados.",
                "Leve o quadril para trás mantendo a coluna reta e a barra rente às pernas.",
                "Desça até sentir alongar os posteriores (geralmente até o meio da canela).",
                "Volte empurrando o quadril para frente e contraindo glúteos."
            ),
            tips = listOf("A coluna não arredonda: pare antes disso.", "Pense em \"fechar a porta com o bumbum\"."),
            alternatives = listOf("rdl_halter", "stiff_elastico", "elevacao_pelvica")
        ),
        Exercise(
            "rdl_halter", "Levantamento terra romeno com halteres", Slot.HINGE, HAMSTRINGS, listOf(GLUTE_MAX, BACK),
            setOf(DUMBBELLS), Anim.HINGE, true, avoidIf = setOf(LOWER_BACK),
            steps = listOf(
                "Em pé com um halter em cada mão à frente das coxas.",
                "Joelhos levemente dobrados; empurre o quadril para trás deslizando os halteres pelas pernas.",
                "Desça até o meio da canela mantendo as costas retas.",
                "Suba estendendo o quadril e contraindo os glúteos."
            ),
            tips = listOf("Ombros para trás e para baixo.", "O movimento é do quadril, não da lombar."),
            alternatives = listOf("stiff_barra", "stiff_elastico")
        ),
        Exercise(
            "rdl_barra", "Levantamento terra romeno com barra", Slot.HINGE, GLUTE_MAX, listOf(HAMSTRINGS, BACK),
            setOf(BARBELL), Anim.HINGE, true, avoidIf = setOf(LOWER_BACK), minLevel = Experience.INTERMEDIATE,
            steps = listOf(
                "Comece em pé segurando a barra na altura do quadril.",
                "Joelhos destravados, leve o quadril para trás com a barra rente às coxas.",
                "Desça até logo abaixo dos joelhos com a coluna neutra.",
                "Volte contraindo glúteos e posteriores."
            ),
            tips = listOf("Mantenha a barra encostada nas pernas.", "Use carga que permita controle total."),
            alternatives = listOf("rdl_halter", "stiff_barra")
        ),
        Exercise(
            "stiff_unilateral", "Stiff unilateral com halter", Slot.HINGE, HAMSTRINGS, listOf(GLUTE_MAX, GLUTE_MED),
            setOf(DUMBBELLS), Anim.HINGE, true, avoidIf = setOf(LOWER_BACK, ANKLE), minLevel = Experience.INTERMEDIATE,
            steps = listOf(
                "Em pé em uma perna, segurando um halter na mão oposta.",
                "Incline o tronco à frente enquanto a perna livre vai para trás, em linha com o tronco.",
                "Desça até sentir alongar o posterior da perna de apoio.",
                "Volte contraindo o glúteo da perna de apoio."
            ),
            tips = listOf("Quadril nivelado, sem girar.", "Apoie a mão livre na parede se precisar."),
            alternatives = listOf("rdl_halter", "ponte_unilateral")
        ),
        Exercise(
            "stiff_elastico", "Stiff com elástico", Slot.HINGE, HAMSTRINGS, listOf(GLUTE_MAX),
            setOf(BANDS), Anim.HINGE, true, avoidIf = setOf(LOWER_BACK),
            steps = listOf(
                "Pise no meio do elástico com os pés na largura do quadril e segure as pontas.",
                "Leve o quadril para trás com a coluna reta.",
                "Desça até sentir alongar os posteriores.",
                "Suba estendendo o quadril contra a resistência do elástico."
            ),
            tips = listOf("Elástico mais curto = mais difícil.", "Controle a volta, não deixe o elástico \"puxar\" você."),
            alternatives = listOf("elevacao_pelvica")
        ),
        Exercise(
            "hiperextensao", "Extensão de quadril no banco 45°", Slot.HINGE, GLUTE_MAX, listOf(HAMSTRINGS, BACK),
            setOf(MACHINES), Anim.HYPEREXT, true, avoidIf = setOf(LOWER_BACK),
            steps = listOf(
                "Ajuste o apoio logo abaixo do quadril e prenda os calcanhares.",
                "Arredonde levemente a parte alta das costas e desça o tronco dobrando o quadril.",
                "Suba contraindo os glúteos até alinhar o corpo (sem passar da linha).",
                "Segure 1 segundo e desça devagar."
            ),
            tips = listOf("Pés levemente abertos aumentam o trabalho de glúteos.", "Não jogue o tronco para trás no final."),
            alternatives = listOf("elevacao_pelvica", "rdl_halter")
        ),

        // ---------------- FLEXÃO DE JOELHOS (posteriores) ----------------
        Exercise(
            "mesa_flexora", "Mesa flexora", Slot.KNEE_FLEX, HAMSTRINGS, listOf(CALVES),
            setOf(MACHINES), Anim.LEG_CURL_LYING, false,
            steps = listOf(
                "Deite de bruços com os joelhos logo após a borda do banco e o rolo acima dos calcanhares.",
                "Segure as alças e mantenha o quadril encostado no banco.",
                "Dobre os joelhos trazendo o rolo em direção aos glúteos.",
                "Volte devagar sem estender totalmente de forma brusca."
            ),
            tips = listOf("Não levante o quadril durante o movimento.", "Volta lenta (3 s) traz ótimo estímulo."),
            alternatives = listOf("cadeira_flexora", "flexora_elastico")
        ),
        Exercise(
            "cadeira_flexora", "Cadeira flexora", Slot.KNEE_FLEX, HAMSTRINGS, emptyList(),
            setOf(MACHINES), Anim.LEG_CURL_SEATED, false,
            steps = listOf(
                "Sente com as costas apoiadas e os joelhos alinhados ao eixo da máquina.",
                "Prenda as coxas com o apoio superior e o rolo acima dos calcanhares.",
                "Dobre os joelhos empurrando o rolo para baixo e para trás.",
                "Volte devagar até quase estender os joelhos."
            ),
            tips = listOf("Inclinar levemente o tronco à frente aumenta o alongamento.", "Evite tirar o quadril do assento."),
            alternatives = listOf("mesa_flexora", "flexora_elastico")
        ),
        Exercise(
            "flexora_elastico", "Flexão de joelhos com elástico (deitada)", Slot.KNEE_FLEX, HAMSTRINGS, emptyList(),
            setOf(BANDS), Anim.LEG_CURL_LYING, false,
            steps = listOf(
                "Prenda o elástico em algo firme e passe-o pelos tornozelos.",
                "Deite de bruços com o elástico esticado.",
                "Dobre os joelhos levando os calcanhares em direção aos glúteos.",
                "Volte devagar."
            ),
            tips = listOf("Mantenha o quadril no chão.", "Sem elástico: use uma toalha deslizando no chão em ponte."),
            alternatives = listOf("elevacao_pelvica")
        ),

        // ---------------- EXTENSÃO DE JOELHOS ----------------
        Exercise(
            "cadeira_extensora", "Cadeira extensora", Slot.KNEE_EXT, QUADS, emptyList(),
            setOf(MACHINES), Anim.LEG_EXTENSION, false,
            steps = listOf(
                "Sente com as costas apoiadas e o joelho alinhado ao eixo da máquina.",
                "Rolo apoiado logo acima dos tornozelos.",
                "Estenda os joelhos até quase esticar e contraia as coxas por 1 segundo.",
                "Desça com controle."
            ),
            tips = listOf("Se sentir dor no joelho, reduza a carga e a amplitude.", "Segure as alças para estabilizar o quadril."),
            alternatives = listOf("extensora_elastico", "agachamento_banco")
        ),
        Exercise(
            "extensora_elastico", "Extensão de joelho sentada com elástico", Slot.KNEE_EXT, QUADS, emptyList(),
            setOf(BANDS), Anim.LEG_EXTENSION, false,
            steps = listOf(
                "Sente numa cadeira firme e prenda o elástico no pé da cadeira e no tornozelo.",
                "Estenda o joelho até a perna ficar quase reta.",
                "Contraia a coxa por 1 segundo no final.",
                "Volte devagar."
            ),
            tips = listOf("Faça uma perna de cada vez.", "Sem elástico, use caneleira ou mochila no pé."),
            alternatives = listOf("agachamento_banco")
        ),

        // ---------------- UNILATERAIS ----------------
        Exercise(
            "afundo_halter", "Afundo com halteres", Slot.LUNGE, QUADS, listOf(GLUTE_MAX, GLUTE_MED),
            setOf(DUMBBELLS), Anim.LUNGE, true, avoidIf = setOf(KNEE),
            steps = listOf(
                "Segure os halteres ao lado do corpo e dê um passo grande à frente.",
                "Desça o joelho de trás em direção ao chão, mantendo o tronco levemente inclinado à frente.",
                "O joelho da frente acompanha a direção do pé.",
                "Suba empurrando com o pé da frente."
            ),
            tips = listOf("Passo mais longo + tronco inclinado = mais glúteos.", "Mantenha o equilíbrio olhando para um ponto fixo."),
            alternatives = listOf("afundo_corpo", "subida_banco")
        ),
        Exercise(
            "bulgaro", "Agachamento búlgaro", Slot.LUNGE, GLUTE_MAX, listOf(QUADS, GLUTE_MED),
            setOf(DUMBBELLS, BENCH), Anim.LUNGE, true, avoidIf = setOf(KNEE), minLevel = Experience.INTERMEDIATE,
            steps = listOf(
                "Apoie o peito de um pé num banco atrás de você.",
                "Com o pé da frente afastado, desça o quadril em linha reta.",
                "Desça até a coxa da frente ficar próxima da paralela ao chão.",
                "Suba empurrando com o calcanhar da frente."
            ),
            tips = listOf("Comece sem peso até ganhar equilíbrio.", "Incline o tronco à frente para enfatizar glúteos."),
            alternatives = listOf("afundo_halter", "subida_banco")
        ),
        Exercise(
            "afundo_corpo", "Afundo com peso do corpo", Slot.LUNGE, QUADS, listOf(GLUTE_MAX),
            setOf(BODYWEIGHT), Anim.LUNGE, true, avoidIf = setOf(KNEE),
            steps = listOf(
                "Em pé, dê um passo à frente.",
                "Desça até os dois joelhos formarem cerca de 90°.",
                "Mantenha o tronco firme e o joelho da frente alinhado ao pé.",
                "Volte à posição inicial e alterne as pernas."
            ),
            tips = listOf("Apoie uma mão na parede se perder o equilíbrio.", "Mochila com peso para progredir."),
            alternatives = listOf("subida_banco", "agachamento_banco")
        ),
        Exercise(
            "subida_banco", "Subida no banco (step-up)", Slot.LUNGE, GLUTE_MAX, listOf(QUADS),
            setOf(BENCH), Anim.STEP_UP, true,
            steps = listOf(
                "Fique de frente para um banco ou degrau firme (altura do joelho ou menor).",
                "Apoie um pé inteiro em cima.",
                "Suba empurrando com o calcanhar do pé de cima, sem impulsionar com a perna de baixo.",
                "Desça devagar e repita do mesmo lado."
            ),
            tips = listOf("Degrau mais baixo se sentir o joelho.", "Segure halteres para progredir."),
            alternatives = listOf("afundo_corpo", "elevacao_pelvica")
        ),

        // ---------------- ABDUÇÃO (glúteo médio) ----------------
        Exercise(
            "cadeira_abdutora", "Cadeira abdutora", Slot.ABDUCTION, GLUTE_MED, listOf(GLUTE_MAX),
            setOf(MACHINES), Anim.ABDUCTION_SEATED, false,
            steps = listOf(
                "Sente com as costas apoiadas e as almofadas por fora dos joelhos.",
                "Abra as pernas afastando os joelhos o máximo que conseguir com controle.",
                "Segure 1 segundo aberta.",
                "Volte devagar sem deixar os pesos baterem."
            ),
            tips = listOf("Inclinar o tronco à frente muda o estímulo para a parte alta do glúteo.", "Repetições lentas e controladas."),
            alternatives = listOf("abducao_elastico", "abducao_deitada")
        ),
        Exercise(
            "abducao_elastico", "Abdução com mini band (sentada)", Slot.ABDUCTION, GLUTE_MED, emptyList(),
            setOf(BANDS), Anim.ABDUCTION_SEATED, false,
            steps = listOf(
                "Coloque a mini band logo acima dos joelhos e sente na ponta de uma cadeira.",
                "Pés apoiados no chão, um pouco afastados.",
                "Abra os joelhos contra o elástico e segure 1 segundo.",
                "Volte devagar mantendo tensão no elástico."
            ),
            tips = listOf("Faça também com o tronco inclinado à frente.", "Elásticos mais fortes para progredir."),
            alternatives = listOf("abducao_deitada")
        ),
        Exercise(
            "abducao_cabo", "Abdução de quadril em pé no cabo", Slot.ABDUCTION, GLUTE_MED, emptyList(),
            setOf(CABLE), Anim.ABDUCTION_STANDING, false,
            steps = listOf(
                "Prenda a caneleira no tornozelo de fora, ficando de lado para a polia baixa.",
                "Segure no aparelho para ter apoio.",
                "Afaste a perna lateralmente sem inclinar o tronco.",
                "Volte devagar."
            ),
            tips = listOf("Ponta do pé levemente para frente.", "Movimento curto e controlado é suficiente."),
            alternatives = listOf("cadeira_abdutora", "abducao_deitada")
        ),
        Exercise(
            "abducao_deitada", "Abdução de quadril deitada de lado", Slot.ABDUCTION, GLUTE_MED, emptyList(),
            setOf(BODYWEIGHT), Anim.ABDUCTION_LYING, false,
            steps = listOf(
                "Deite de lado com as pernas estendidas e o corpo alinhado.",
                "Eleve a perna de cima com o pé levemente virado para baixo.",
                "Suba até a altura do quadril e segure 1 segundo.",
                "Desça devagar."
            ),
            tips = listOf("Não gire o quadril para trás.", "Use caneleira ou mini band para progredir."),
            alternatives = listOf("abducao_elastico")
        ),

        // ---------------- COICE ----------------
        Exercise(
            "coice_cabo", "Coice no cabo (glúteo na polia)", Slot.KICKBACK, GLUTE_MAX, listOf(HAMSTRINGS),
            setOf(CABLE), Anim.KICKBACK_STANDING, false,
            steps = listOf(
                "Prenda a caneleira no tornozelo e fique de frente para a polia baixa.",
                "Incline levemente o tronco à frente segurando no aparelho.",
                "Leve a perna para trás e para cima contraindo o glúteo.",
                "Volte devagar sem apoiar o pé."
            ),
            tips = listOf("Não arqueie a lombar para subir mais.", "Pense em empurrar com o calcanhar."),
            alternatives = listOf("coice_quatro_apoios", "coice_maquina")
        ),
        Exercise(
            "coice_maquina", "Glúteo na máquina (coice)", Slot.KICKBACK, GLUTE_MAX, listOf(HAMSTRINGS),
            setOf(MACHINES), Anim.KICKBACK_STANDING, false,
            steps = listOf(
                "Apoie o tronco e posicione o pé na plataforma da máquina.",
                "Empurre a plataforma para trás estendendo o quadril.",
                "Contraia o glúteo no final do movimento.",
                "Volte com controle."
            ),
            tips = listOf("Mantenha o abdômen firme.", "Amplitude controlada, sem impulso."),
            alternatives = listOf("coice_cabo", "coice_quatro_apoios")
        ),
        Exercise(
            "coice_quatro_apoios", "Coice em quatro apoios", Slot.KICKBACK, GLUTE_MAX, listOf(HAMSTRINGS),
            setOf(BODYWEIGHT), Anim.DONKEY_KICK, false,
            steps = listOf(
                "Fique em quatro apoios: mãos abaixo dos ombros e joelhos abaixo do quadril.",
                "Com o joelho dobrado a 90°, empurre o pé em direção ao teto.",
                "Contraia o glúteo no topo sem arquear a lombar.",
                "Volte devagar."
            ),
            tips = listOf("Apoie nos antebraços se sentir os punhos.", "Use caneleira ou mini band para progredir."),
            alternatives = listOf("elevacao_pelvica")
        ),

        // ---------------- PANTURRILHAS ----------------
        Exercise(
            "panturrilha_pe", "Panturrilha em pé (máquina ou Smith)", Slot.CALF, CALVES, emptyList(),
            setOf(MACHINES), Anim.CALF_STANDING, false,
            steps = listOf(
                "Apoie a ponta dos pés na plataforma com os calcanhares para fora.",
                "Desça os calcanhares até sentir alongar.",
                "Suba na ponta dos pés o máximo possível.",
                "Segure 1 segundo no topo."
            ),
            tips = listOf("Pausa de 1 segundo embaixo evita o \"efeito mola\".", "Joelhos estendidos (sem travar)."),
            alternatives = listOf("panturrilha_degrau")
        ),
        Exercise(
            "panturrilha_sentada", "Panturrilha sentada", Slot.CALF, CALVES, emptyList(),
            setOf(MACHINES), Anim.CALF_SEATED, false,
            steps = listOf(
                "Sente com o apoio sobre as coxas, perto dos joelhos.",
                "Pontas dos pés na plataforma.",
                "Desça os calcanhares e depois suba o máximo possível.",
                "Movimento lento e controlado."
            ),
            tips = listOf("Trabalha principalmente o sóleo.", "Sem máquina: sente e apoie halteres sobre os joelhos."),
            alternatives = listOf("panturrilha_degrau")
        ),
        Exercise(
            "panturrilha_degrau", "Panturrilha em pé no degrau", Slot.CALF, CALVES, emptyList(),
            setOf(BODYWEIGHT), Anim.CALF_STANDING, false, avoidIf = setOf(ANKLE),
            steps = listOf(
                "Apoie a ponta dos pés na borda de um degrau, segurando na parede.",
                "Desça os calcanhares abaixo do degrau.",
                "Suba na ponta dos pés o máximo possível.",
                "Segure 1 segundo e desça devagar."
            ),
            tips = listOf("Faça com uma perna de cada vez para progredir.", "Segure um halter para aumentar a carga."),
            alternatives = listOf("panturrilha_pe")
        ),

        // ---------------- CORE ----------------
        Exercise(
            "prancha", "Prancha frontal", Slot.CORE, CORE, listOf(SHOULDERS),
            setOf(BODYWEIGHT), Anim.PLANK, false, timeBased = true,
            steps = listOf(
                "Apoie antebraços e pontas dos pés no chão, cotovelos abaixo dos ombros.",
                "Corpo em linha reta da cabeça aos calcanhares.",
                "Contraia abdômen e glúteos e respire normalmente.",
                "Mantenha a posição pelo tempo indicado."
            ),
            tips = listOf("Iniciante: apoie os joelhos no chão.", "Não deixe o quadril cair nem subir demais."),
            alternatives = listOf("dead_bug")
        ),
        Exercise(
            "prancha_lateral", "Prancha lateral", Slot.CORE, CORE, listOf(GLUTE_MED),
            setOf(BODYWEIGHT), Anim.SIDE_PLANK, false, avoidIf = setOf(SHOULDER), timeBased = true,
            steps = listOf(
                "Deite de lado apoiada no antebraço, cotovelo abaixo do ombro.",
                "Eleve o quadril formando uma linha reta.",
                "Mantenha a posição pelo tempo indicado.",
                "Repita do outro lado."
            ),
            tips = listOf("Versão mais fácil: joelhos dobrados e apoiados.", "Trabalha também o glúteo médio."),
            alternatives = listOf("dead_bug")
        ),
        Exercise(
            "abdominal_polia", "Abdominal na polia (ajoelhada)", Slot.CORE, CORE, emptyList(),
            setOf(CABLE), Anim.CABLE_CRUNCH, false,
            steps = listOf(
                "Ajoelhe de frente para a polia alta segurando a corda ao lado do rosto.",
                "Mantenha o quadril parado.",
                "Enrole o tronco levando os cotovelos em direção às coxas.",
                "Volte devagar sentindo o abdômen alongar."
            ),
            tips = listOf("O movimento é de \"enrolar\" a coluna, não de sentar sobre os calcanhares.", "Expire ao descer."),
            alternatives = listOf("abdominal_supra")
        ),
        Exercise(
            "abdominal_supra", "Abdominal supra (crunch)", Slot.CORE, CORE, emptyList(),
            setOf(BODYWEIGHT), Anim.CRUNCH, false,
            steps = listOf(
                "Deite de barriga para cima com joelhos dobrados e pés no chão.",
                "Mãos atrás da cabeça sem puxar o pescoço.",
                "Eleve as escápulas do chão contraindo o abdômen.",
                "Desça devagar."
            ),
            tips = listOf("Imagine aproximar as costelas do quadril.", "Olhar para o teto, queixo afastado do peito."),
            alternatives = listOf("dead_bug")
        ),
        Exercise(
            "elevacao_pernas", "Elevação de pernas deitada", Slot.CORE, CORE, emptyList(),
            setOf(BODYWEIGHT), Anim.LEG_RAISE, false, avoidIf = setOf(LOWER_BACK), minLevel = Experience.INTERMEDIATE,
            steps = listOf(
                "Deite de barriga para cima com as mãos sob o quadril.",
                "Pernas estendidas (ou levemente dobradas).",
                "Eleve as pernas até cerca de 90° mantendo a lombar no chão.",
                "Desça devagar sem encostar os pés no chão."
            ),
            tips = listOf("Se a lombar sair do chão, dobre os joelhos.", "Expire ao subir."),
            alternatives = listOf("dead_bug")
        ),
        Exercise(
            "dead_bug", "Dead bug", Slot.CORE, CORE, emptyList(),
            setOf(BODYWEIGHT), Anim.DEAD_BUG, false,
            steps = listOf(
                "Deite de barriga para cima, braços para o teto e joelhos dobrados a 90° no ar.",
                "Cole a lombar no chão contraindo o abdômen.",
                "Estenda um braço para trás e a perna oposta à frente, devagar.",
                "Volte e alterne os lados."
            ),
            tips = listOf("Excelente e seguro para iniciantes e para a lombar.", "Expire enquanto estende."),
            alternatives = listOf("prancha")
        ),

        // ---------------- COSTAS ----------------
        Exercise(
            "puxada_alta", "Puxada alta (pulldown)", Slot.VERTICAL_PULL, BACK, listOf(BICEPS, SHOULDERS),
            setOf(CABLE), Anim.PULLDOWN, true,
            steps = listOf(
                "Sente com as coxas presas no apoio e segure a barra um pouco além da largura dos ombros.",
                "Incline levemente o tronco para trás e abra o peito.",
                "Puxe a barra até a parte alta do peito levando os cotovelos para baixo.",
                "Volte devagar até estender os braços."
            ),
            tips = listOf("Pense em puxar com os cotovelos, não com as mãos.", "Não balance o tronco."),
            alternatives = listOf("puxada_elastico", "remada_halter")
        ),
        Exercise(
            "puxada_elastico", "Puxada com elástico", Slot.VERTICAL_PULL, BACK, listOf(BICEPS),
            setOf(BANDS), Anim.PULLDOWN, true,
            steps = listOf(
                "Prenda o elástico no alto (porta ou barra) e ajoelhe ou sente de frente para ele.",
                "Braços estendidos à frente e acima.",
                "Puxe levando os cotovelos para baixo e para os lados do corpo.",
                "Volte devagar."
            ),
            tips = listOf("Aperte as escápulas no final.", "Afaste-se do ponto de apoio para mais resistência."),
            alternatives = listOf("superman")
        ),
        Exercise(
            "remada_baixa", "Remada baixa sentada no cabo", Slot.HORIZONTAL_PULL, BACK, listOf(BICEPS, SHOULDERS),
            setOf(CABLE), Anim.ROW_SEATED, true,
            steps = listOf(
                "Sente com os pés apoiados e joelhos levemente dobrados, segurando o triângulo.",
                "Coluna ereta e peito aberto.",
                "Puxe o triângulo em direção ao abdômen levando os cotovelos para trás.",
                "Volte estendendo os braços sem arredondar as costas."
            ),
            tips = listOf("Junte as escápulas no final.", "Não jogue o tronco para trás."),
            alternatives = listOf("remada_maquina", "remada_halter", "remada_elastico")
        ),
        Exercise(
            "remada_maquina", "Remada na máquina (articulada)", Slot.HORIZONTAL_PULL, BACK, listOf(BICEPS),
            setOf(MACHINES), Anim.ROW_SEATED, true,
            steps = listOf(
                "Ajuste o banco para que as pegadas fiquem na altura do peito.",
                "Peito apoiado no suporte.",
                "Puxe as pegadas levando os cotovelos para trás.",
                "Volte devagar."
            ),
            tips = listOf("Mantenha os ombros longe das orelhas.", "Pausa de 1 s com escápulas unidas."),
            alternatives = listOf("remada_baixa", "remada_halter")
        ),
        Exercise(
            "remada_halter", "Remada unilateral com halter (serrote)", Slot.HORIZONTAL_PULL, BACK, listOf(BICEPS, SHOULDERS),
            setOf(DUMBBELLS, BENCH), Anim.ROW_BENT, true,
            steps = listOf(
                "Apoie um joelho e a mão do mesmo lado num banco, tronco paralelo ao chão.",
                "Segure o halter com o braço estendido.",
                "Puxe o halter em direção ao quadril levando o cotovelo para trás.",
                "Desça devagar."
            ),
            tips = listOf("Costas retas e abdômen firme.", "Não gire o tronco para subir o peso."),
            alternatives = listOf("remada_elastico", "remada_mochila")
        ),
        Exercise(
            "remada_elastico", "Remada com elástico", Slot.HORIZONTAL_PULL, BACK, listOf(BICEPS),
            setOf(BANDS), Anim.ROW_SEATED, true,
            steps = listOf(
                "Sente com as pernas estendidas e passe o elástico pela sola dos pés.",
                "Segure as pontas com os braços estendidos.",
                "Puxe levando os cotovelos para trás e unindo as escápulas.",
                "Volte devagar."
            ),
            tips = listOf("Coluna ereta durante todo o movimento.", "Cruze o elástico para mais tensão."),
            alternatives = listOf("remada_mochila", "superman")
        ),
        Exercise(
            "remada_mochila", "Remada curvada com mochila ou galões de água", Slot.HORIZONTAL_PULL, BACK, listOf(BICEPS),
            setOf(BODYWEIGHT), Anim.ROW_BENT, true, avoidIf = setOf(LOWER_BACK),
            steps = listOf(
                "Coloque peso numa mochila (livros, garrafas) ou segure galões de água.",
                "Incline o tronco à frente com joelhos levemente dobrados e coluna reta.",
                "Puxe o peso em direção ao abdômen.",
                "Desça devagar."
            ),
            tips = listOf("Apoie uma mão numa mesa e faça um braço por vez para proteger a lombar.", "Escápulas unidas no final."),
            alternatives = listOf("superman")
        ),
        Exercise(
            "superman", "Extensão de costas no chão (superman)", Slot.HORIZONTAL_PULL, BACK, listOf(GLUTE_MAX, SHOULDERS),
            setOf(BODYWEIGHT), Anim.SUPERMAN, false,
            steps = listOf(
                "Deite de bruços com os braços estendidos à frente.",
                "Eleve braços, peito e pernas alguns centímetros do chão.",
                "Segure 2 segundos contraindo costas e glúteos.",
                "Desça devagar."
            ),
            tips = listOf("Olhe para o chão para proteger o pescoço.", "Movimento pequeno e controlado."),
            alternatives = listOf("remada_mochila")
        ),

        // ---------------- OMBROS ----------------
        Exercise(
            "desenvolvimento_halter", "Desenvolvimento de ombros com halteres", Slot.VERTICAL_PUSH, SHOULDERS, listOf(TRICEPS),
            setOf(DUMBBELLS), Anim.SHOULDER_PRESS, true, avoidIf = setOf(SHOULDER),
            steps = listOf(
                "Sente com as costas apoiadas e os halteres na altura dos ombros.",
                "Cotovelos levemente à frente do corpo.",
                "Empurre os halteres para cima até quase estender os braços.",
                "Desça devagar até a altura das orelhas."
            ),
            tips = listOf("Não arqueie a lombar.", "Abdômen firme o tempo todo."),
            alternatives = listOf("desenvolvimento_maquina", "desenvolvimento_elastico", "desenvolvimento_galao")
        ),
        Exercise(
            "desenvolvimento_maquina", "Desenvolvimento na máquina", Slot.VERTICAL_PUSH, SHOULDERS, listOf(TRICEPS),
            setOf(MACHINES), Anim.SHOULDER_PRESS, true, avoidIf = setOf(SHOULDER),
            steps = listOf(
                "Ajuste o banco para que as pegadas fiquem na altura dos ombros.",
                "Costas totalmente apoiadas.",
                "Empurre para cima sem travar os cotovelos.",
                "Desça com controle."
            ),
            tips = listOf("Boa opção para aprender o movimento com segurança.", "Expire ao empurrar."),
            alternatives = listOf("desenvolvimento_halter")
        ),
        Exercise(
            "desenvolvimento_elastico", "Desenvolvimento com elástico", Slot.VERTICAL_PUSH, SHOULDERS, listOf(TRICEPS),
            setOf(BANDS), Anim.SHOULDER_PRESS, true, avoidIf = setOf(SHOULDER),
            steps = listOf(
                "Pise no elástico e segure as pontas na altura dos ombros.",
                "Empurre para cima até quase estender os braços.",
                "Volte devagar.",
                "Mantenha o tronco firme."
            ),
            tips = listOf("Pode ser feito sentada.", "Afaste os pés para aumentar a resistência."),
            alternatives = listOf("desenvolvimento_galao")
        ),
        Exercise(
            "desenvolvimento_galao", "Desenvolvimento com garrafas ou galões", Slot.VERTICAL_PUSH, SHOULDERS, listOf(TRICEPS),
            setOf(BODYWEIGHT), Anim.SHOULDER_PRESS, true, avoidIf = setOf(SHOULDER),
            steps = listOf(
                "Segure garrafas de água ou galões na altura dos ombros.",
                "Empurre para cima até quase estender os braços.",
                "Desça devagar.",
                "Mantenha o abdômen contraído."
            ),
            tips = listOf("Encha mais as garrafas para progredir.", "Faça sentada se perder o equilíbrio."),
            alternatives = listOf("elevacao_lateral_galao")
        ),
        Exercise(
            "elevacao_lateral", "Elevação lateral com halteres", Slot.LATERAL_RAISE, SHOULDERS, emptyList(),
            setOf(DUMBBELLS), Anim.LATERAL_RAISE, false, loadStep = 1.0,
            steps = listOf(
                "Em pé com um halter em cada mão ao lado do corpo.",
                "Cotovelos levemente dobrados.",
                "Eleve os braços lateralmente até a altura dos ombros.",
                "Desça devagar."
            ),
            tips = listOf("Use cargas leves: o ombro é um músculo pequeno.", "Não suba os ombros em direção às orelhas."),
            alternatives = listOf("elevacao_lateral_cabo", "elevacao_lateral_elastico", "elevacao_lateral_galao")
        ),
        Exercise(
            "elevacao_lateral_cabo", "Elevação lateral no cabo", Slot.LATERAL_RAISE, SHOULDERS, emptyList(),
            setOf(CABLE), Anim.LATERAL_RAISE, false, loadStep = 1.0,
            steps = listOf(
                "Fique de lado para a polia baixa segurando a pegada com a mão de fora.",
                "Eleve o braço lateralmente até a altura do ombro.",
                "Volte devagar.",
                "Complete as repetições e troque o lado."
            ),
            tips = listOf("Tensão constante durante todo o movimento.", "Tronco firme, sem balançar."),
            alternatives = listOf("elevacao_lateral")
        ),
        Exercise(
            "elevacao_lateral_elastico", "Elevação lateral com elástico", Slot.LATERAL_RAISE, SHOULDERS, emptyList(),
            setOf(BANDS), Anim.LATERAL_RAISE, false,
            steps = listOf(
                "Pise no elástico e segure as pontas ao lado do corpo.",
                "Eleve os braços lateralmente até a altura dos ombros.",
                "Volte devagar.",
                "Cotovelos levemente dobrados."
            ),
            tips = listOf("Comece com elástico leve.", "Controle a descida."),
            alternatives = listOf("elevacao_lateral_galao")
        ),
        Exercise(
            "elevacao_lateral_galao", "Elevação lateral com garrafas", Slot.LATERAL_RAISE, SHOULDERS, emptyList(),
            setOf(BODYWEIGHT), Anim.LATERAL_RAISE, false,
            steps = listOf(
                "Segure duas garrafas de água ao lado do corpo.",
                "Eleve os braços lateralmente até a altura dos ombros.",
                "Desça devagar.",
                "Mantenha os ombros relaxados."
            ),
            tips = listOf("Garrafas de 1,5 L ≈ 1,5 kg.", "Faça 2 s de subida e 3 s de descida."),
            alternatives = listOf("elevacao_lateral")
        ),

        // ---------------- PEITORAL ----------------
        Exercise(
            "supino_halter", "Supino com halteres", Slot.HORIZONTAL_PUSH, CHEST, listOf(TRICEPS, SHOULDERS),
            setOf(DUMBBELLS, BENCH), Anim.CHEST_PRESS, true,
            steps = listOf(
                "Deite num banco com um halter em cada mão na altura do peito.",
                "Pés firmes no chão e escápulas unidas.",
                "Empurre os halteres para cima até quase estender os braços.",
                "Desça devagar até a lateral do peito."
            ),
            tips = listOf("Cotovelos a cerca de 45° do corpo.", "Não bata os halteres no topo."),
            alternatives = listOf("supino_maquina", "flexao_inclinada")
        ),
        Exercise(
            "supino_maquina", "Supino na máquina (chest press)", Slot.HORIZONTAL_PUSH, CHEST, listOf(TRICEPS, SHOULDERS),
            setOf(MACHINES), Anim.PRESS_SEATED, true,
            steps = listOf(
                "Ajuste o banco para as pegadas ficarem na altura do meio do peito.",
                "Costas apoiadas e escápulas unidas.",
                "Empurre as pegadas à frente sem travar os cotovelos.",
                "Volte devagar."
            ),
            tips = listOf("Expire ao empurrar.", "Mantenha os ombros para trás."),
            alternatives = listOf("supino_halter", "flexao_inclinada")
        ),
        Exercise(
            "flexao_inclinada", "Flexão de braços inclinada (mãos no banco)", Slot.HORIZONTAL_PUSH, CHEST, listOf(TRICEPS, CORE),
            setOf(BENCH), Anim.PUSHUP, true, avoidIf = setOf(WRIST),
            steps = listOf(
                "Apoie as mãos num banco, mesa firme ou parede, um pouco além da largura dos ombros.",
                "Corpo reto da cabeça aos calcanhares.",
                "Desça o peito em direção ao apoio dobrando os cotovelos.",
                "Empurre de volta."
            ),
            tips = listOf("Quanto mais alto o apoio, mais fácil.", "Abdômen e glúteos contraídos."),
            alternatives = listOf("flexao_joelhos")
        ),
        Exercise(
            "flexao_joelhos", "Flexão de braços com joelhos apoiados", Slot.HORIZONTAL_PUSH, CHEST, listOf(TRICEPS, CORE),
            setOf(BODYWEIGHT), Anim.PUSHUP, true, avoidIf = setOf(WRIST),
            steps = listOf(
                "Apoie mãos e joelhos no chão, mãos um pouco além dos ombros.",
                "Corpo reto dos joelhos à cabeça.",
                "Desça o peito em direção ao chão.",
                "Empurre de volta."
            ),
            tips = listOf("Evolua para flexão completa quando fizer 15 repetições.", "Não deixe o quadril cair."),
            alternatives = listOf("flexao_inclinada")
        ),

        // ---------------- BRAÇOS ----------------
        Exercise(
            "rosca_halter", "Rosca direta com halteres", Slot.BICEPS, BICEPS, emptyList(),
            setOf(DUMBBELLS), Anim.CURL, false, loadStep = 1.0,
            steps = listOf(
                "Em pé, halteres ao lado do corpo com as palmas para frente.",
                "Cotovelos colados ao corpo.",
                "Dobre os cotovelos levando os halteres aos ombros.",
                "Desça devagar."
            ),
            tips = listOf("Sem balançar o tronco.", "Descida em 2–3 segundos."),
            alternatives = listOf("rosca_cabo", "rosca_elastico", "rosca_galao")
        ),
        Exercise(
            "rosca_cabo", "Rosca no cabo", Slot.BICEPS, BICEPS, emptyList(),
            setOf(CABLE), Anim.CURL, false, loadStep = 1.0,
            steps = listOf(
                "De frente para a polia baixa, segure a barra com as palmas para cima.",
                "Cotovelos ao lado do corpo.",
                "Dobre os cotovelos até a barra chegar perto do peito.",
                "Volte devagar."
            ),
            tips = listOf("Tensão constante.", "Punhos firmes."),
            alternatives = listOf("rosca_halter")
        ),
        Exercise(
            "rosca_elastico", "Rosca com elástico", Slot.BICEPS, BICEPS, emptyList(),
            setOf(BANDS), Anim.CURL, false,
            steps = listOf(
                "Pise no elástico e segure as pontas com as palmas para frente.",
                "Cotovelos colados ao corpo.",
                "Dobre os cotovelos.",
                "Volte devagar."
            ),
            tips = listOf("Encurte o elástico para mais resistência.", "Controle a volta."),
            alternatives = listOf("rosca_galao")
        ),
        Exercise(
            "rosca_galao", "Rosca com galões ou garrafas", Slot.BICEPS, BICEPS, emptyList(),
            setOf(BODYWEIGHT), Anim.CURL, false,
            steps = listOf(
                "Segure garrafas ou galões ao lado do corpo.",
                "Dobre os cotovelos levando o peso aos ombros.",
                "Desça devagar.",
                "Cotovelos parados ao lado do corpo."
            ),
            tips = listOf("Galão de 5 L ≈ 5 kg.", "Faça devagar para aumentar a dificuldade."),
            alternatives = listOf("rosca_elastico")
        ),
        Exercise(
            "triceps_polia", "Tríceps na polia (pushdown)", Slot.TRICEPS, TRICEPS, emptyList(),
            setOf(CABLE), Anim.PUSHDOWN, false, loadStep = 1.0,
            steps = listOf(
                "De frente para a polia alta, segure a corda ou barra.",
                "Cotovelos colados ao corpo.",
                "Estenda os cotovelos empurrando para baixo.",
                "Volte devagar até cerca de 90°."
            ),
            tips = listOf("Só o antebraço se move.", "Abra a corda no final para contrair mais."),
            alternatives = listOf("triceps_frances", "triceps_elastico")
        ),
        Exercise(
            "triceps_frances", "Tríceps francês com halter (sentada)", Slot.TRICEPS, TRICEPS, emptyList(),
            setOf(DUMBBELLS), Anim.OVERHEAD_EXT, false, avoidIf = setOf(SHOULDER), loadStep = 1.0,
            steps = listOf(
                "Sente com as costas apoiadas segurando um halter com as duas mãos acima da cabeça.",
                "Desça o halter atrás da cabeça dobrando os cotovelos.",
                "Estenda os cotovelos voltando à posição inicial.",
                "Cotovelos apontando para frente."
            ),
            tips = listOf("Não abra demais os cotovelos.", "Abdômen firme para não arquear a lombar."),
            alternatives = listOf("triceps_elastico", "triceps_banco")
        ),
        Exercise(
            "triceps_elastico", "Tríceps com elástico", Slot.TRICEPS, TRICEPS, emptyList(),
            setOf(BANDS), Anim.PUSHDOWN, false,
            steps = listOf(
                "Prenda o elástico no alto de uma porta.",
                "Cotovelos colados ao corpo.",
                "Estenda os cotovelos empurrando para baixo.",
                "Volte devagar."
            ),
            tips = listOf("Afaste-se para aumentar a resistência.", "Punhos firmes."),
            alternatives = listOf("triceps_banco")
        ),
        Exercise(
            "triceps_banco", "Tríceps no banco (mergulho)", Slot.TRICEPS, TRICEPS, listOf(SHOULDERS),
            setOf(BENCH), Anim.DIP, false, avoidIf = setOf(SHOULDER, WRIST),
            steps = listOf(
                "Apoie as mãos na borda de um banco ou cadeira firme, atrás do corpo.",
                "Pernas dobradas e pés no chão.",
                "Desça o corpo dobrando os cotovelos até cerca de 90°.",
                "Empurre de volta."
            ),
            tips = listOf("Mantenha as costas perto do banco.", "Não desça além do confortável para o ombro."),
            alternatives = listOf("triceps_elastico")
        )
    )

    private val byId = all.associateBy { it.id }
    fun get(id: String): Exercise? = byId[id]
    fun require(id: String): Exercise = byId[id] ?: error("Exercício desconhecido: $id")

    /** Equipamentos disponíveis considerando o local. */
    fun availableEquipment(p: UserProfile): Set<Equipment> =
        if (p.location == Location.GYM) Equipment.entries.toSet()
        else p.homeEquipment + BODYWEIGHT

    fun isAllowed(e: Exercise, p: UserProfile, equipment: Set<Equipment> = availableEquipment(p)): Boolean =
        equipment.containsAll(e.equipment) &&
            e.avoidIf.none { it in p.limitations } &&
            e.minLevel.ordinal <= p.experience.ordinal &&
            e.id !in p.excludedExercises

    /** Alternativas executáveis sem o equipamento original (para a tela de detalhes). */
    fun alternativesFor(e: Exercise, p: UserProfile? = null): List<Exercise> {
        val explicit = e.alternatives.mapNotNull { get(it) }
        val sameSlot = all.filter { it.slot == e.slot && it.id != e.id && it.id !in e.alternatives }
        val list = (explicit + sameSlot).distinctBy { it.id }
        return if (p == null) list.take(4) else list.filter { it.avoidIf.none { l -> l in p.limitations } }.take(4)
    }
}
