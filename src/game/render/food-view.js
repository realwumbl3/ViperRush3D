import {
    updateFoodArrowTransform,
    updateFoodVisualTransforms
} from './entities.js';
import { FOOD_ARROW_CAMERA_OFFSET } from '../config/entities.js';
import { runtime } from '../runtime.js';
import { foodArrowWorldPos, foodArrowToFood, foodArrowForward } from '../scratch.js';
import { isGameplayActive } from '../game-state.js';

export function updateFoodArrow() {
    updateFoodArrowTransform({
        foodArrow: runtime.foodArrow,
        food: runtime.food,
        camera: runtime.camera,
        isGameplayActive: isGameplayActive(),
        foodArrowCameraOffset: FOOD_ARROW_CAMERA_OFFSET,
        foodArrowWorldPos,
        foodArrowToFood,
        foodArrowForward
    });
}

export function updateFoodVisuals(elapsedSeconds, delta) {
    updateFoodVisualTransforms(runtime.food, elapsedSeconds, delta);
}
