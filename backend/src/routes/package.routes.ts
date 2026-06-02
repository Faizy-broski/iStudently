import { Router } from 'express';
import { PackageController } from '../controllers/package.controller';
// import {
//   validateCreatePackage,
//   validatePackageIdParam,
//   validateStudentQuery
// } from '../package.validation';

const router = Router();

router.post(
  '/',
  PackageController.create
);

router.get(
  '/',
  PackageController.getAll
)

router.get(
  '/',
  PackageController.getPending
);

router.patch(
  '/:id/pickup',
  PackageController.pickup
);

export default router;
