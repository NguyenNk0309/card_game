import type { ActionCard, Hero, Realm } from "@/shared/types";

export const HERO_TEMPLATES: Omit<Hero, "id" | "team" | "isYou">[] = [
  { name: "Elara Voss", title: "Ngọn Đèn Bất Diệt", role: "Hộ vệ", classId: "warden", className: "Hộ vệ chiến thuật", passiveName: "Liên Kết", passiveText: "Mọi lá Hỗ trợ của Elara tăng thêm 1 điểm hiệu lực.", skill: "Cùng Nhau Đứng Vững", skillText: "Tăng sát thương cho toàn bộ đồng minh.", summary: "Hộ vệ linh hoạt giúp cả đội tấn công ổn định.", strength: "Buff đội và tạo khiên cho đồng minh tốt.", weakness: "Sát thương trực tiếp thấp.", impact: "Biến các lượt tấn công của đồng minh thành đòn kết liễu.", hp: 10, maxHp: 10, color: "#d5b56b", initials: "EV" },
  { name: "Thorne Vale", title: "Mũi Tên Cuối", role: "Xạ thủ", classId: "ranger", className: "Xạ thủ", passiveName: "Ngắm Chuẩn", passiveText: "Đòn đánh đơn mục tiêu gây thêm 1 sát thương.", skill: "Mũi Tên Đánh Dấu", skillText: "Đòn bắn chính xác gây sát thương lớn.", summary: "Xạ thủ chuyên hạ từng đối thủ.", strength: "Sát thương đơn mục tiêu ổn định.", weakness: "Ít khả năng tự bảo vệ.", impact: "Nhanh chóng loại một kẻ địch nguy hiểm khỏi trận.", hp: 9, maxHp: 9, color: "#82a88a", initials: "TV" },
  { name: "Mira Ash", title: "Lưỡi Lửa Tro Tàn", role: "Pháp sư", classId: "mage", className: "Pháp sư AOE", passiveName: "Lửa Lan", passiveText: "Mọi đòn AOE gây thêm 1 sát thương lên mỗi mục tiêu.", skill: "Biển Lửa", skillText: "Thiêu đốt toàn bộ đội địch.", summary: "Pháp sư mỏng manh nhưng gây sát thương diện rộng mạnh nhất.", strength: "AOE mạnh, ép máu cả đội địch.", weakness: "HP thấp và ít phòng thủ.", impact: "Rút ngắn trận đấu bằng cách làm suy yếu mọi đối thủ cùng lúc.", hp: 7, maxHp: 7, color: "#bd705c", initials: "MA" },
  { name: "Brother Orren", title: "Người Gánh Thương", role: "Hồi phục", classId: "healer", className: "Tu sĩ hồi phục", passiveName: "Sinh Lực Bền Bỉ", passiveText: "Mỗi lá Hồi máu của Orren hồi thêm 2 HP cho đồng minh được chọn.", skill: "Lời Nguyện Sinh Mệnh", skillText: "Hồi máu mạnh cho một đồng minh đang nguy cấp.", summary: "Tu sĩ duy trì tổng HP của đội bằng hồi máu trực tiếp và hồi phục toàn đội.", strength: "Cứu đồng minh yếu và hồi phục cả đội.", weakness: "Chỉ có một lá tấn công đặc biệt.", impact: "Giữ đồng đội sống sót và giúp đội thắng phép so tổng HP ở lượt 30.", hp: 11, maxHp: 11, color: "#789bad", initials: "BO" },
  { name: "Nyx Calder", title: "Lưỡi Dao Trong Bóng", role: "Sát thủ", classId: "assassin", className: "Sát thủ", passiveName: "Xuyên Giáp", passiveText: "Mọi đòn đánh của Nyx bỏ qua toàn bộ khiên.", skill: "Dao Im Lặng", skillText: "Đâm xuyên khiên của một kẻ địch.", summary: "Sát thủ chuyên kết liễu mục tiêu được bảo vệ.", strength: "Bỏ qua khiên và dồn sát thương nhanh.", weakness: "HP thấp, không có hồi phục đặc biệt.", impact: "Phá thế thủ và ngăn đối thủ câu giờ bằng khiên.", hp: 8, maxHp: 8, color: "#9a83b7", initials: "NC" },
  { name: "Bram Coalhand", title: "Tường Thành Than Đỏ", role: "Đỡ đòn", classId: "tank", className: "Đỡ đòn", passiveName: "Thép Tôi", passiveText: "Mỗi lá Phòng thủ của Bram tạo thêm 2 khiên cho đồng minh được chọn.", skill: "Pháo Đài Sống", skillText: "Tạo lượng khiên lớn cho một đồng minh.", summary: "Người bảo hộ bền bỉ, có thể che chắn cho bất kỳ đồng minh nào.", strength: "HP cao và tạo khiên mạnh cho đồng đội.", weakness: "Sát thương thấp.", impact: "Giữ một thành viên sống để ngăn đội bị quét sạch.", hp: 13, maxHp: 13, color: "#c98b58", initials: "BC" },
  { name: "Sable Fen", title: "Mắt Nhìn Bão Tố", role: "Tiên tri", classId: "oracle", className: "Tiên tri", passiveName: "Báo Trước Tai Họa", passiveText: "Đội của Sable nhận ít hơn 1 sát thương từ sự kiện thế giới.", skill: "Điềm Báo Máu", skillText: "Buff tấn công cho toàn bộ đồng minh.", summary: "Tiên tri kiểm soát nhịp trận và giảm thiệt hại sự kiện.", strength: "Bảo vệ đội trước biến cố, buff tốt.", weakness: "HP thấp.", impact: "Làm các lượt sự kiện 5/10/15... ít nguy hiểm hơn cho đội.", hp: 7, maxHp: 7, color: "#6aa8a5", initials: "SF" },
  { name: "Kael Rook", title: "Kẻ Thách Đấu", role: "Đấu sĩ", classId: "duelist", className: "Đấu sĩ", passiveName: "Không Phòng Thủ", passiveText: "Khi không có khiên, đòn đánh gây thêm 1 sát thương.", skill: "Phản Kích", skillText: "Đòn đánh đơn mục tiêu cực mạnh.", summary: "Đấu sĩ thuần tấn công, mạnh nhất khi không phòng thủ.", strength: "Dồn sát thương liên tục.", weakness: "Không có hồi máu hoặc buff.", impact: "Buộc đội địch phải xử lý Kael trước.", hp: 9, maxHp: 9, color: "#a96161", initials: "KR" },
  { name: "Ione Mire", title: "Người Giữ Lời Thề", role: "Hỗ trợ", classId: "support", className: "Hỗ trợ", passiveName: "Hiệu Lệnh", passiveText: "Mọi buff Hỗ trợ của Ione tăng thêm 1 điểm.", skill: "Mệnh Lệnh Tiến Công", skillText: "Tăng sát thương cho toàn đội.", summary: "Chuyên gia buff giúp đồng minh mạnh hơn qua nhiều lượt.", strength: "Buff tấn công, khiên và hồi phục.", weakness: "Sát thương cá nhân thấp.", impact: "Khuếch đại sức mạnh của cả đội thay vì tự mình kết liễu.", hp: 8, maxHp: 8, color: "#bd9f76", initials: "IM" },
  { name: "Dagan Flint", title: "Máu Của Tiền Tuyến", role: "Cuồng chiến", classId: "berserker", className: "Cuồng chiến", passiveName: "Càng Đau Càng Mạnh", passiveText: "Khi còn không quá nửa HP, đòn đánh gây thêm 1 sát thương.", skill: "Không Ai Sống Sót", skillText: "Đòn AOE mạnh khi Dagan bị thương.", summary: "Chiến binh càng bị thương càng nguy hiểm.", strength: "HP cao và sát thương cuối trận lớn.", weakness: "Dễ bị tập trung kết liễu khi xuống thấp.", impact: "Tạo áp lực ngược khi đội địch cố hạ Dagan.", hp: 12, maxHp: 12, color: "#768493", initials: "DF" }
];

type CharacterSkillCard = Omit<ActionCard, "unique">;

export const CHARACTER_SKILL_CARDS: Record<string, CharacterSkillCard[]> = {
  "Elara Voss": [
    { id: "ev-stand", name: "Cùng Nhau Đứng Vững", type: "Spirit", description: "Toàn bộ đồng minh nhận +2 sát thương cho đòn đánh kế tiếp; nội tại tăng thành +3.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "attack" },
    { id: "ev-ward", name: "Khiên Đèn", type: "Spirit", description: "Chọn một đồng minh còn sống để nhận 4 khiên; có thể chọn Elara.", bonus: 4, effect: "guard", target: "ally", value: 4 },
    { id: "ev-command", name: "Lệnh Tiến Tuyến", type: "Spirit", description: "Chọn một đồng minh khác và đưa lượt của họ lên ngay sau Elara.", bonus: 4, effect: "support", target: "ally", value: 1, supportType: "advance-ally" }
  ],
  "Thorne Vale": [
    { id: "tv-mark", name: "Mũi Tên Đánh Dấu", type: "Wit", description: "Gây 4 sát thương; nội tại Xạ thủ tăng thành 5.", bonus: 5, effect: "damage", target: "enemy", value: 4 },
    { id: "tv-pierce", name: "Tên Xuyên Giáp", type: "Wit", description: "Gây 3 sát thương và bỏ qua toàn bộ khiên.", bonus: 4, effect: "damage", target: "enemy", value: 3, ignoresShield: true },
    { id: "tv-volley", name: "Mưa Tên", type: "Might", description: "Gây 2 sát thương lên tất cả kẻ địch còn sống.", bonus: 4, effect: "aoe", target: "all-enemies", value: 2 }
  ],
  "Mira Ash": [
    { id: "ma-inferno", name: "Biển Lửa", type: "Might", description: "Gây 3 sát thương AOE; nội tại tăng thành 4. Nếu thất bại, cả đội nhận 1 sát thương.", bonus: 4, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "team-damage", failureValue: 1 },
    { id: "ma-comet", name: "Sao Chổi Tro", type: "Wit", description: "Gây 2 sát thương AOE, bỏ qua khiên.", bonus: 5, effect: "aoe", target: "all-enemies", value: 2, ignoresShield: true },
    { id: "ma-rekindle", name: "Tái Sinh Từ Tro", type: "Spirit", description: "Chọn một đồng minh còn sống để hồi 4 HP; không thể hồi sinh.", bonus: 4, effect: "heal", target: "ally", value: 4 }
  ],
  "Brother Orren": [
    { id: "bo-prayer", name: "Lời Nguyện Sinh Mệnh", type: "Spirit", description: "Chọn một đồng minh để hồi 5 HP; nội tại tăng thành 7 HP.", bonus: 4, effect: "heal", target: "ally", value: 5 },
    { id: "bo-blessing", name: "Phúc Lành", type: "Spirit", description: "Hồi ngay 2 HP cho toàn bộ đồng minh còn sống.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "healing" },
    { id: "bo-smite", name: "Trừng Phạt", type: "Might", description: "Gây 3 sát thương lên một kẻ địch.", bonus: 5, effect: "damage", target: "enemy", value: 3 }
  ],
  "Nyx Calder": [
    { id: "nc-knife", name: "Dao Im Lặng", type: "Wit", description: "Gây 4 sát thương; nội tại Sát thủ luôn bỏ qua khiên.", bonus: 5, effect: "damage", target: "enemy", value: 4 },
    { id: "nc-execute", name: "Kết Liễu", type: "Might", description: "Gây 5 sát thương xuyên khiên. Nếu thất bại, Nyx nhận 3 sát thương.", bonus: 3, effect: "damage", target: "enemy", value: 5, ignoresShield: true, failureEffect: "self-damage", failureValue: 3 },
    { id: "nc-delay", name: "Đánh Lạc Hướng", type: "Wit", description: "Chọn một kẻ địch và đẩy lượt sắp tới của họ xuống cuối hàng đợi.", bonus: 4, effect: "support", target: "enemy", value: 1, supportType: "delay-enemy" }
  ],
  "Bram Coalhand": [
    { id: "bc-fortress", name: "Pháo Đài Sống", type: "Might", description: "Chọn một đồng minh nhận 5 khiên; nội tại tăng thành 7 khiên.", bonus: 4, effect: "guard", target: "ally", value: 5 },
    { id: "bc-temper", name: "Tôi Giáp", type: "Spirit", description: "Tạo ngay 2 khiên cho toàn bộ đồng minh còn sống.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "shield" },
    { id: "bc-hammer", name: "Búa Nện", type: "Might", description: "Gây 3 sát thương lên một kẻ địch.", bonus: 4, effect: "damage", target: "enemy", value: 3 }
  ],
  "Sable Fen": [
    { id: "sf-omen", name: "Điềm Báo Máu", type: "Wit", description: "Toàn bộ đồng minh nhận +2 sát thương cho đòn kế tiếp.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "attack" },
    { id: "sf-mist", name: "Sương Hồi Sinh", type: "Spirit", description: "Chọn một đồng minh còn sống để hồi 3 HP; không thể hồi sinh.", bonus: 5, effect: "heal", target: "ally", value: 3 },
    { id: "sf-hex", name: "Điềm Xấu", type: "Wit", description: "Chọn một kẻ địch: họ bị -3 kết quả d20 trong lượt kế tiếp.", bonus: 4, effect: "support", target: "enemy", value: 3, supportType: "enemy-dice" }
  ],
  "Kael Rook": [
    { id: "kr-riposte", name: "Phản Kích", type: "Might", description: "Gây 5 sát thương; khi không có khiên tăng thành 6. Nếu thất bại, Kael nhận 2 sát thương.", bonus: 4, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 2 },
    { id: "kr-duel", name: "Thách Đấu", type: "Might", description: "Gây 4 sát thương lên một kẻ địch.", bonus: 5, effect: "damage", target: "enemy", value: 4 },
    { id: "kr-sweep", name: "Quét Kiếm", type: "Might", description: "Gây 2 sát thương lên toàn bộ kẻ địch.", bonus: 4, effect: "aoe", target: "all-enemies", value: 2 }
  ],
  "Ione Mire": [
    { id: "im-command", name: "Mệnh Lệnh Tiến Công", type: "Spirit", description: "Buff +2 sát thương cho toàn đội; nội tại tăng thành +3.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "attack" },
    { id: "im-aegis", name: "Mệnh Lệnh Tập Trung", type: "Spirit", description: "Mọi đồng minh nhận +2 bonus d20 cho lượt kế tiếp; nội tại tăng thành +3.", bonus: 4, effect: "support", target: "all-allies", value: 2, supportType: "dice" },
    { id: "im-break", name: "Bẻ Gãy Mệnh Lệnh", type: "Wit", description: "Chọn một kẻ địch: xóa buff tấn công, buff d20 và phá tối đa 3 khiên.", bonus: 4, effect: "support", target: "enemy", value: 3, supportType: "dispel-enemy" }
  ],
  "Dagan Flint": [
    { id: "df-none", name: "Không Ai Sống Sót", type: "Might", description: "Gây 3 sát thương AOE; khi Dagan còn nửa HP tăng thành 4. Thất bại: Dagan nhận 2 sát thương.", bonus: 4, effect: "aoe", target: "all-enemies", value: 3, failureEffect: "self-damage", failureValue: 2 },
    { id: "df-cleave", name: "Bổ Đôi", type: "Might", description: "Gây 5 sát thương. Nếu thất bại, Dagan nhận 2 sát thương.", bonus: 4, effect: "damage", target: "enemy", value: 5, failureEffect: "self-damage", failureValue: 2 },
    { id: "df-blood", name: "Chia Máu", type: "Spirit", description: "Chọn một đồng minh còn sống để hồi 3 HP, có thể chọn Dagan.", bonus: 4, effect: "heal", target: "ally", value: 3 }
  ]
};

export const ACTION_CARDS: ActionCard[] = [
  { id: "slash", name: "Chém Ngang", type: "Might", description: "Gây 3 sát thương lên một kẻ địch; khiên hấp thụ trước HP.", bonus: 4, effect: "damage", target: "enemy", value: 3, unique: false },
  { id: "heavy", name: "Đòn Nặng", type: "Might", description: "Gây 4 sát thương. Nếu thất bại, người dùng nhận 1 sát thương.", bonus: 3, effect: "damage", target: "enemy", value: 4, failureEffect: "self-damage", failureValue: 1, unique: false },
  { id: "brace", name: "Thủ Thế", type: "Spirit", description: "Tự tạo 3 khiên cho bản thân.", bonus: 5, effect: "guard", target: "self", value: 3, unique: false },
  { id: "iron-wall", name: "Tường Sắt", type: "Might", description: "Tự tạo 5 khiên. Nếu thất bại, mất tối đa 2 khiên đang có.", bonus: 3, effect: "guard", target: "self", value: 5, failureEffect: "lose-shield", failureValue: 2, unique: false },
  { id: "second-wind", name: "Hồi Sức", type: "Spirit", description: "Tự hồi 4 HP; không thể hồi sinh khi đã gục.", bonus: 4, effect: "heal", target: "self", value: 4, unique: false }
];

export const REALMS: Realm[] = [
  { id: "arena", name: "Đấu Trường Lời Thề", region: "Chiến tuyến cuối", weather: "Không có đường lui", objective: "Đánh bại toàn bộ đội đối phương trước hoặc tại lượt 30.", threat: "Đội đối phương", accent: "#d4b56e", sceneClass: "scene-arena" }
];

export const STORY_BEATS = [
  "Hai đội đối mặt nhau. Chỉ một đội có thể rời khỏi đấu trường.",
  "Tiếng kim loại vang lên khi một chiến binh chọn mục tiêu tiếp theo.",
  "Máu và khiên quyết định ai còn đứng vững sau lượt này.",
  "Không còn nhiệm vụ phụ: hạ đối thủ hoặc bị hạ.",
  "Mỗi lá bài đã dùng tiến gần hơn tới phán quyết ở lượt 30."
];

export const EVENTS = [
  "Biến cố chiến trường",
  "Hỗn loạn bất ngờ",
  "Lời nguyền leo thang",
  "Tiếp tế bí ẩn",
  "Mặt đất rung chuyển"
];
