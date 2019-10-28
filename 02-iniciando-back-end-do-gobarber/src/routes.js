import { Router } from 'express';

import UserController from './app/controllers/UserController';
import SessionController from './app/controllers/SessionController';

// Router() = new Router()
// call constructor/function and returns an object with the defined functions and attributes of the class
const routes = new Router();
routes.post('/users', UserController.store);
routes.post('/sessions', SessionController.store);

export default routes;
