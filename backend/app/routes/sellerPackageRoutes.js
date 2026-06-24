import express from 'express';
import { 
    getAvailableTemplates, 
    getSellerPackages, 
    createOrUpdateSellerPackage, 
    deleteSellerPackage 
} from '../controller/sellerPackageController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require seller authentication
router.use(verifyToken);

router.get('/templates', getAvailableTemplates);
router.get('/my-packages', getSellerPackages);
router.post('/my-packages', createOrUpdateSellerPackage);
router.delete('/my-packages/:id', deleteSellerPackage);

export default router;
