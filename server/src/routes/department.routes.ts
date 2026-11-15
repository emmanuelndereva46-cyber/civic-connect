import { Router } from "express";
import { getActiveDepartments } from "../controllers/department.controller.js";

const router = Router();

router.get("/", getActiveDepartments);

export default router;
