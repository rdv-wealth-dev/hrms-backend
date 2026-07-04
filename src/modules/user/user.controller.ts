import { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service";
import { buildSuccessResponse } from "../../core/database/base.schema";

const userService = new UserService();

export class UserController {

    async listUsers(
        req: Request,
        res: Response, 
        next: NextFunction
    ) : Promise<void> {
        try { 
            const result = await userService.listUsers(req.context);
            res.status(200).json(
                buildSuccessResponse(result, "Users fetched Successfully")
            );
        } catch (error) {
            next(error);
        }
    }

    async assignRole(
        req : Request<{ id : string}>,
        res : Response,
        next : NextFunction
    ) : Promise<void> {
        try {
            const result = await userService.assignRole(req.context, req.params.id, req.body);
            res.status(200).json(
                buildSuccessResponse(result, "Role assign successfully")
            );
        } catch (error) {
            next(error);
        }
    }
}
