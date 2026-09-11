const fs = require('fs');

['teacher', 'staff', 'parent'].forEach(type => {
  const path = `d:/thesocialnexus/studently/backend/src/routes/${type}.routes.ts`;
  let content = fs.readFileSync(path, 'utf8');
  const routeCode = type === 'teacher'
    ? `\nrouter.post('/group-assign', requireAdmin, teacherController.groupAssignTeachers)\n`
    : type === 'staff'
      ? `\nrouter.post('/group-assign', requireRole('admin'), StaffController.groupAssignStaff)\n`
      : `\nrouter.post('/group-assign', requireRole('admin'), (req, res) => parentController.groupAssignParents(req, res))\n`;
  content = content.replace('export default router', routeCode + '\nexport default router');
  fs.writeFileSync(path, content);
});
