# two_sum.py
from typing import List
import json

class Solution:
    def twoSum(self, nums: List[int], target: int) -> str:
        seen = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in seen:
                return json.dumps([seen[diff], i])  # ensures "[0,1]"
            seen[num] = i
        return json.dumps([])
# ✔️ Now your backend will get the exact string format it’s expecting.