package vn.edu.hcmut.campusevents.catalog;

import java.util.List;

/** Department choices and display order supplied by the project owner. Codes are internal keys. */
public final class DepartmentCatalog {
    public record Definition(String code, String name) {}

    public static final List<Definition> ENTRIES = List.of(
            new Definition("EEE", "Khoa Điện – Điện tử"),
            new Definition("CIVIL", "Khoa Kỹ thuật Xây dựng"),
            new Definition("ME", "Khoa Cơ khí"),
            new Definition("CHE", "Khoa Kỹ thuật Hoá học"),
            new Definition("CSE", "Khoa Khoa học và Kỹ thuật Máy tính"),
            new Definition("MSE", "Khoa Công nghệ Vật liệu"),
            new Definition("AS", "Khoa Khoa học Ứng dụng"),
            new Definition("TRANS", "Khoa Kỹ thuật Giao thông"),
            new Definition("IEM", "Khoa Quản lý Công nghiệp"),
            new Definition("GEO_PET", "Khoa Kỹ thuật Địa chất và Dầu khí"),
            new Definition("ENV", "Khoa Môi trường và Tài nguyên"),
            new Definition("PFIEV", "CT KỸ SƯ CHẤT LƯỢNG CAO PFIEV"));

    private static final List<String> CODES = ENTRIES.stream().map(Definition::code).toList();

    private DepartmentCatalog() {}

    public static List<String> codes() {
        return CODES;
    }
}
