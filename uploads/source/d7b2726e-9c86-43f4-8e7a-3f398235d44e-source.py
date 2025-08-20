import ast

def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []

if __name__ == "__main__":
    nums = ast.literal_eval(input())  # safely parse list from string like "[2,7,11,15]"
    target = int(input())
    result = two_sum(nums, target)
    print(" ".join(map(str, result)))  # output like: 0 1
