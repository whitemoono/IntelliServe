import os
import re
import json

def get_badge_color(category):
    category_lower = category.lower()
    if '架构' in category_lower or 'design' in category_lower:
        return 'blue'
    elif 'api' in category_lower or '通信' in category_lower:
        return 'green'
    elif '数据' in category_lower or 'data' in category_lower:
        return 'orange'
    elif '部署' in category_lower or '运维' in category_lower or 'deployment' in category_lower:
        return 'purple'
    elif '用户' in category_lower or 'guide' in category_lower:
        return 'cyan'
    elif '开发' in category_lower or '测试' in category_lower or 'development' in category_lower or 'testing' in category_lower:
        return 'red'
    return 'blue'

def build():
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    doc_dir = os.path.join(workspace_root, "doc")
    website_js_dir = os.path.join(workspace_root, "website", "js")
    
    readme_path = os.path.join(doc_dir, "README.md")
    
    print(f"Workspace root: {workspace_root}")
    print(f"Docs directory: {doc_dir}")
    print(f"README path: {readme_path}")
    
    if not os.path.exists(readme_path):
        print(f"Error: README.md not found at {readme_path}")
        return

    # Read README.md to build structure
    with open(readme_path, "r", encoding="utf-8") as f:
        readme_content = f.read()

    # Parse categories and items from README
    sections = []
    current_section = None
    
    # We only parse headings and tables inside the "文档导航" section.
    # We find where "## 📖 文档导航" starts and where the next "## " starts.
    nav_start_match = re.search(r"## 📖 文档导航", readme_content)
    if not nav_start_match:
        # Fallback to older search
        nav_start_idx = 0
        nav_end_idx = len(readme_content)
    else:
        nav_start_idx = nav_start_match.start()
        # Find next "## " header after "## 📖 文档导航"
        next_h2_match = re.search(r"\n##\s", readme_content[nav_start_idx + 10:])
        if next_h2_match:
            nav_end_idx = nav_start_idx + 10 + next_h2_match.start()
        else:
            nav_end_idx = len(readme_content)
            
    nav_section_text = readme_content[nav_start_idx:nav_end_idx]
    
    lines = nav_section_text.split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith("###"):
            # Clean section header e.g. "### 架构与设计 (architecture/)"
            sec_name = re.sub(r"^###\s*", "", line)
            # Remove any trailing path indicator like (architecture/)
            sec_name = re.sub(r"\s*\([^)]+\)", "", sec_name).strip()
            
            current_section = {
                "section": sec_name,
                "items": []
            }
            sections.append(current_section)
        elif line.startswith("|") and current_section is not None:
            # Table row. Ignore header row or line separator row
            if "编号" in line or "---" in line:
                continue
            parts = [p.strip() for p in line.split("|")]
            # Format: | 编号 | 文档 | 说明 | 状态 |
            if len(parts) >= 5:
                doc_id = parts[1]
                doc_link = parts[2]
                doc_desc = parts[3]
                doc_status = parts[4]
                
                # Parse markdown link e.g. [解决方案概述](architecture/DOC-00-解决方案概述.md)
                link_match = re.search(r"\[([^\]]+)\]\(([^)]+)\)", doc_link)
                if link_match:
                    title = link_match.group(1)
                    rel_path = link_match.group(2)
                    
                    # Normalize the path to start with doc/ and use forward slashes
                    normalized_path = f"doc/{rel_path}".replace("\\", "/")
                    
                    # Prepend ID to title if not already present
                    full_title = f"{doc_id} {title}" if doc_id and doc_id not in title else title
                    
                    current_section["items"].append({
                        "id": doc_id,
                        "path": normalized_path,
                        "title": full_title,
                        "desc": doc_desc,
                        "status": doc_status,
                        "badge": get_badge_color(current_section["section"])
                    })

    # Filter out empty sections
    sections = [s for s in sections if s["items"]]

    # Scan all markdown files in doc/ directory to build content database and find any uncategorized docs
    all_md_files = []
    for root, dirs, files in os.walk(doc_dir):
        for file in files:
            if file.endswith(".md") and file != "README.md":
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, workspace_root).replace("\\", "/")
                all_md_files.append(rel_path)

    # Find registered paths
    registered_paths = set()
    for sec in sections:
        for item in sec["items"]:
            registered_paths.add(item["path"])

    # Find uncategorized paths
    uncategorized_items = []
    for path in all_md_files:
        if path not in registered_paths:
            print(f"Warning: Found uncategorized document: {path}")
            # Try to guess a name
            name_without_ext = os.path.basename(path).replace(".md", "")
            uncategorized_items.append({
                "id": "",
                "path": path,
                "title": name_without_ext,
                "desc": "未在 README.md 中列出的文档",
                "status": "草稿",
                "badge": "gray"
            })

    if uncategorized_items:
        sections.append({
            "section": "未分类文档",
            "items": uncategorized_items
        })

    # Read content of all files and store in DOCS_DATA
    docs_data = {}
    total_size = 0
    for path in all_md_files:
        full_path = os.path.join(workspace_root, path)
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
                docs_data[path] = content
                total_size += len(content.encode('utf-8'))

    # Output website/js/docs-data.js
    docs_data_js_path = os.path.join(website_js_dir, "docs-data.js")
    os.makedirs(os.path.dirname(docs_data_js_path), exist_ok=True)
    with open(docs_data_js_path, "w", encoding="utf-8") as f:
        f.write("/* Automatically generated by scripts/build_docs.py. Do not edit manually. */\n")
        f.write("const DOCS_DATA = ")
        json.dump(docs_data, f, ensure_ascii=False, indent=2)
        f.write(";\n")
    print(f"Generated {docs_data_js_path} ({len(all_md_files)} files, {total_size / 1024:.1f} KB)")

    # Output website/js/docs-nav.js
    docs_nav_js_path = os.path.join(website_js_dir, "docs-nav.js")
    with open(docs_nav_js_path, "w", encoding="utf-8") as f:
        f.write("/* Automatically generated by scripts/build_docs.py. Do not edit manually. */\n")
        f.write("const DOC_REGISTRY = ")
        json.dump(sections, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        f.write(f"\nconst DOCS_STATS = {{\n  count: {len(all_md_files)},\n  categories: {len(sections)},\n  size_kb: {round(total_size / 1024)},\n  version: 'v1.0'\n}};\n")
    print(f"Generated {docs_nav_js_path}")

    # Output doc/all_docs.json as well for backward compatibility / API use
    all_docs_json_path = os.path.join(doc_dir, "all_docs.json")
    with open(all_docs_json_path, "w", encoding="utf-8") as f:
        json.dump(docs_data, f, ensure_ascii=False, indent=2)
    print(f"Generated {all_docs_json_path}")

if __name__ == "__main__":
    build()
