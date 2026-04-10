import {
    FOOD_FLOAT_BASE_Y,
    FOOD_BOB_SPEED,
    FOOD_BOB_AMPLITUDE,
    FOOD_SPIN_Y_SPEED,
    FOOD_SPIN_X_SPEED
} from '../config/entities.js';

export function updateFoodArrowTransform({
    foodArrow,
    food,
    camera,
    isGameplayActive,
    foodArrowCameraOffset,
    foodArrowWorldPos,
    foodArrowToFood,
    foodArrowForward
}) {
    if (!foodArrow || !food || !camera) return;
    if (!isGameplayActive) {
        foodArrow.visible = false;
        return;
    }

    foodArrowWorldPos.copy(foodArrowCameraOffset).applyQuaternion(camera.quaternion).add(camera.position);
    foodArrow.position.copy(foodArrowWorldPos);

    foodArrowToFood.copy(food.position).sub(foodArrowWorldPos);
    if (foodArrowToFood.lengthSq() < 1e-8) {
        foodArrow.visible = false;
        return;
    }

    foodArrow.quaternion.setFromUnitVectors(foodArrowForward, foodArrowToFood.normalize());
    foodArrow.visible = true;
}

export function updateFoodVisualTransforms(food, elapsedSeconds, delta) {
    if (!food) return;
    food.position.y = FOOD_FLOAT_BASE_Y + Math.sin(elapsedSeconds * FOOD_BOB_SPEED) * FOOD_BOB_AMPLITUDE;
    food.rotation.y += FOOD_SPIN_Y_SPEED * delta;
    food.rotation.x += FOOD_SPIN_X_SPEED * delta;
}
