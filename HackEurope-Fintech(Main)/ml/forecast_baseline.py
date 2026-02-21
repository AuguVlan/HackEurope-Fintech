from statistics import mean


def moving_average_forecast(values: list[int], window: int = 3) -> int:
    if not values:
        return 0
    sample = values[-window:]
    return int(mean(sample))


if __name__ == "__main__":
    sample = [10000, 12000, 14000, 9000, 15000]
    print(moving_average_forecast(sample))
