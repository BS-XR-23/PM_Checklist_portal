#!/usr/bin/env python3
"""
One-time preprocessing: turns PMP_Template.docx's plain bracket placeholders
into docxtemplater merge tags, so the app can fill it at runtime with pure JS
(docxtemplater + pizzip, no Python dependency in the running app).

Run once (or whenever PMP_Template.docx changes upstream):
    python3 scripts/prepare_pmp_template.py

Output: portal/templates/pmp-plan-template.docx (committed to the repo).
Formatting (bold labels, italic gray placeholder text) is left exactly as-is —
only the text content of the placeholder runs is replaced with {tag} syntax,
matching how PMP_Template_Filled_Demo.docx shows a "properly filled" doc
keeping the same run styling as the blank template.
"""
import os
import docx

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, "PMP_Template.docx")
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "pmp-plan-template.docx")

# paragraph index -> new full text (single-run paragraphs)
SINGLE_RUN_REPLACEMENTS = {
    2: "Project Name: {project_name}",
    3: "Prepared by: {prepared_by}",
    4: "Date: {plan_date}",
    5: "Version: {version}",
    12: "{rationale}",
    47: "Escalation Path:  {escalation_path}",
}

# paragraph index -> tag name (two-run "Label: " + " [bracket]" paragraphs;
# run 0 - the bold label - is left untouched, only run 1 is replaced)
LABELED_LINE_TAGS = {
    16: "charter_objective",
    17: "charter_scope_in",
    18: "charter_scope_out",
    19: "charter_success_criteria",
    20: "charter_timeline",
    21: "charter_budget",
    22: "charter_assumptions",
    23: "charter_pm_authority",
    25: "method_approach",
    26: "method_cadence",
    27: "method_ceremonies",
    28: "method_tools",
    29: "method_roles",
    30: "method_change_mgmt",
    32: "test_levels",
    33: "test_environments",
    34: "test_entry_criteria",
    35: "test_exit_criteria",
    36: "test_defect_mgmt",
    37: "test_uat_process",
    38: "test_deliverables",
    40: "deploy_environments",
    41: "deploy_release_strategy",
    42: "deploy_steps",
    43: "deploy_rollback",
    44: "deploy_golive_checklist",
    45: "deploy_monitoring",
}

# table index -> (loop name, [column tag names])
TABLE_LOOPS = {
    0: ("stakeholders", ["stakeholder", "role", "responsibility", "accessRequired"]),
    1: ("comms", ["audience", "frequency", "channel", "content"]),
    2: ("raci", ["activity", "pm", "tl", "ba", "leadEng", "creativeLead"]),
}


def main():
    doc = docx.Document(SOURCE)

    for idx, new_text in SINGLE_RUN_REPLACEMENTS.items():
        p = doc.paragraphs[idx]
        assert len(p.runs) >= 1, f"paragraph {idx} has no runs: {p.text!r}"
        p.runs[0].text = new_text
        for extra in p.runs[1:]:
            extra.text = ""

    for idx, tag in LABELED_LINE_TAGS.items():
        p = doc.paragraphs[idx]
        assert len(p.runs) == 2, f"paragraph {idx} expected 2 runs, got {len(p.runs)}: {p.text!r}"
        p.runs[1].text = f" {{{tag}}}"

    for table_idx, (loop_name, columns) in TABLE_LOOPS.items():
        table = doc.tables[table_idx]
        template_row = table.rows[1]
        for col_idx, tag in enumerate(columns):
            cell_tag = f"{{{tag}}}"
            if col_idx == 0:
                cell_tag = f"{{#{loop_name}}}" + cell_tag
            if col_idx == len(columns) - 1:
                cell_tag = cell_tag + f"{{/{loop_name}}}"
            template_row.cells[col_idx].text = cell_tag

        # Remove the remaining sample rows (everything after the template row).
        for row in list(table.rows[2:]):
            row._element.getparent().remove(row._element)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    doc.save(OUTPUT)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
