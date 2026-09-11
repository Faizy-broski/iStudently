const fs = require('fs');

const path = 'd:/thesocialnexus/studently/frontend/src/config/sidebar.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '{ title: "bulk_import", href: "/admin/teachers/bulk-import", icon: Upload },',
  '{ title: "bulk_import", href: "/admin/teachers/bulk-import", icon: Upload },\n      { title: "group_assign", href: "/admin/teachers/group-assign", icon: Users },'
);

content = content.replace(
  '{ title: "bulk_import", href: "/admin/staff/bulk-import", icon: Upload },',
  '{ title: "bulk_import", href: "/admin/staff/bulk-import", icon: Upload },\n      { title: "group_assign", href: "/admin/staff/group-assign", icon: Users },'
);

content = content.replace(
  '{ title: "bulk_import", href: "/admin/parents/bulk-import", icon: Upload },',
  '{ title: "bulk_import", href: "/admin/parents/bulk-import", icon: Upload },\n      { title: "group_assign", href: "/admin/parents/group-assign", icon: Users },'
);

fs.writeFileSync(path, content);
