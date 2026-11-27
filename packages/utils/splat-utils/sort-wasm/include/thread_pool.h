#pragma once
#include <atomic>
#include <concepts>
#include <condition_variable>
#include <cstddef>
#include <exception>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <queue>
#include <stop_token>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>

namespace splat_sort {
std::size_t default_thread_count() noexcept;
// The sorting worker sets the helper count once before the first sort.
void configure_default_pool(std::size_t thread_count) noexcept;
class ThreadPool {
public:
    ThreadPool(std::size_t thread_count = default_thread_count());
    ThreadPool(ThreadPool&& other) noexcept;

    template<
        typename F, typename... Args,
        typename ReturnType = std::invoke_result_t<std::decay_t<F>, std::decay_t<Args>...>>
        requires std::invocable<std::decay_t<F>, std::decay_t<Args>...>
    std::future<ReturnType> submit_task(F&& f, Args&&... args);
    std::size_t thread_count() const noexcept;
    ThreadPool& operator=(ThreadPool&& other) noexcept;
    void stop() noexcept;
    ~ThreadPool() noexcept;

    ThreadPool(const ThreadPool& other) = delete;
    ThreadPool& operator=(const ThreadPool& other) = delete;

private:
    using Task = std::function<void()>;

    struct State {
        std::queue<Task> tasks;
        std::mutex queue_mutex;
        std::condition_variable_any cv;
        std::atomic<bool> stopped { false };
        std::vector<std::jthread> workers;

        void stop() noexcept;
        ~State() noexcept;
    };

    static void worker_loop(std::stop_token token, State* state);

    std::unique_ptr<State> state_;
};

// C++ initializes this process-wide pool on the first call, including concurrent calls.
ThreadPool& default_pool();

template<typename F, typename... Args, typename ReturnType>
    requires std::invocable<std::decay_t<F>, std::decay_t<Args>...>
std::future<ReturnType> ThreadPool::submit_task(F&& f, Args&&... args) {
    auto* state = this->state_.get();
    if (state == nullptr || state->stopped.load(std::memory_order_relaxed)) {
        std::terminate();
    }
    auto task = std::make_shared<std::packaged_task<ReturnType()>>(
        [function = std::forward<F>(f), ... arguments = std::forward<Args>(args)]() mutable -> ReturnType {
            return std::invoke(std::move(function), std::move(arguments)...);
        }
    );
    auto future = task->get_future();
    {
        auto lock = std::lock_guard(state->queue_mutex);
        if (state->stopped.load(std::memory_order_relaxed)) {
            std::terminate();
        }
        state->tasks.emplace([task = std::move(task)] { (*task)(); });
    }
    state->cv.notify_one();
    return future;
}
} // namespace splat_sort
