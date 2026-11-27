#include "thread_pool.h"
#include <atomic>
#include <cstddef>
#include <memory>
#include <mutex>
#include <queue>
#include <stop_token>
#include <utility>

namespace splat_sort {
namespace {
std::size_t configured_thread_count(std::size_t initial) noexcept {
    static const std::size_t count = initial;
    return count;
}
} // namespace

std::size_t default_thread_count() noexcept { return configured_thread_count(0); }

void configure_default_pool(std::size_t thread_count) noexcept { configured_thread_count(thread_count); }

ThreadPool& default_pool() {
    static ThreadPool pool(default_thread_count());
    return pool;
}

ThreadPool::ThreadPool(std::size_t thread_count) : state_(std::make_unique<State>()) {
    this->state_->workers.reserve(thread_count);
    for (std::size_t i = 0; i < thread_count; ++i) {
        this->state_->workers.emplace_back(worker_loop, this->state_.get());
    }
}

ThreadPool::ThreadPool(ThreadPool&& other) noexcept = default;
ThreadPool& ThreadPool::operator=(ThreadPool&& other) noexcept = default;
ThreadPool::~ThreadPool() noexcept = default;

std::size_t ThreadPool::thread_count() const noexcept { return this->state_ ? this->state_->workers.size() : 0; }

void ThreadPool::stop() noexcept {
    if (this->state_) {
        this->state_->stop();
    }
}

void ThreadPool::State::stop() noexcept {
    if (this->stopped.exchange(true, std::memory_order_relaxed)) {
        return;
    }
    {
        // Destroy cancelled tasks after unlocking, before joining workers.
        std::queue<Task> cancelled;
        std::lock_guard lock(this->queue_mutex);
        cancelled.swap(this->tasks);
    }
    for (auto& worker : this->workers) {
        worker.request_stop();
    }
    this->workers.clear();
}

ThreadPool::State::~State() noexcept { this->stop(); }

void ThreadPool::worker_loop(std::stop_token token, State* state) {
    while (true) {
        ThreadPool::Task task;
        {
            auto lk = std::unique_lock(state->queue_mutex);
            if (!state->cv.wait(lk, token, [&] { return !state->tasks.empty(); }) ||
                state->stopped.load(std::memory_order_relaxed)) {
                break;
            }
            task = std::move(state->tasks.front());
            state->tasks.pop();
        }
        task();
    }
}
} // namespace splat_sort
