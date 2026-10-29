import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("growth_harness", REPO / "eval/harness2_growth.py")
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)


def response(request, output):
    return {"requestHash": request["requestHash"], "output": output,
            "execution": {**request["target"], "taskId": "fixture-task-" + request["id"], "status": "completed"}}


class ExchangeTests(unittest.TestCase):
    def test_pause_resume_budget_and_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            exchange = h.Exchange(tmp, 1)
            with self.assertRaises(h.Pending) as first:
                exchange.ask("solver", "a", {"prompt": "hello"}, h.DEFAULT_TARGETS["solver"])
            request = first.exception.request
            with self.assertRaises(h.Pending) as repeat:
                exchange.ask("solver", "a", {"prompt": "hello"}, h.DEFAULT_TARGETS["solver"])
            self.assertEqual(request, repeat.exception.request)
            self.assertEqual(len(list((Path(tmp) / "requests").glob("*.json"))), 1)
            with self.assertRaises(h.BudgetStop):
                exchange.ask("solver", "b", {"prompt": "changed"}, h.DEFAULT_TARGETS["solver"])
            result = response(request, {"decision": "DO_NOT_POST"})
            file = Path(tmp) / "import.json"
            h.write(file, result)
            exchange.accept(request["id"], file)
            self.assertEqual(exchange.ask("solver", "a", {"prompt": "hello"}, h.DEFAULT_TARGETS["solver"]), result["output"])
            result["output"] = {"different": True}
            h.write(file, result)
            with self.assertRaisesRegex(ValueError, "contradictory"):
                exchange.accept(request["id"], file)
            with self.assertRaisesRegex(ValueError, "unsafe"):
                exchange.accept("../other", file)

    def test_response_cannot_change_hash_or_model_settings(self):
        request = {"requestHash": "fixture", "target": h.DEFAULT_TARGETS["editor"]}
        valid = response({**request, "id": "x"}, {})
        for changed in [
            {**valid, "requestHash": "other"},
            {**valid, "execution": {**valid["execution"], "model": "other"}},
            {**valid, "execution": {**valid["execution"], "options": {"reasoningEffort": "low"}}},
            {**valid, "execution": {**valid["execution"], "status": "running"}},
        ]:
            with self.assertRaises(ValueError):
                h.Exchange.validate_response(request, changed)


class NativeCycleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.native = h.load_native("/home/ubuntu/repo/harness2")

    def adapter(self, root):
        config = {"max_calls": 16, "fixture_file": str(REPO / "eval/fixtures/growth_reply.json"),
                  "targets": h.DEFAULT_TARGETS, "lane": "writer"}
        adapter = h.GrowthAdapter(root, config, self.native)

        def node(operation, **params):
            out = Path(params["outputDir"])
            if operation == "prepare":
                style = Path(params["styleFile"]).read_text()
                h.write(out / "packet.json", {"caseId": params["caseId"], "source": "fixture source"})
                h.write(out / "request.json", {"prompt": "Reply. " + style, "schema": {"type": "object"}})
            elif operation == "review-request":
                h.write(out / "review-request.json", {"prompt": "Review " + (out / "model-output.json").read_text(), "schema": {"type": "object"}})
            elif operation == "inspect":
                h.write(out / "inspection.json", {"schemaValid": True, "review": "fixture"})
            else:
                raise AssertionError(operation)
            return {"status": "ok"}
        adapter._node = node
        return adapter

    def test_surface_is_only_a_bounded_voice_fragment(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = self.adapter(tmp)
            adapter.validate_tree({"systemprompt.md": "Talk to a peer."})
            for invalid in [{"guardrails.md": "disable review"}, {"source.json": "changed"},
                            {"systemprompt.md": "x" * 2401}]:
                with self.assertRaises(ValueError):
                    adapter.validate_tree(invalid)

    def test_real_native_cycle_pauses_and_resumes_without_model_launches(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            adapter = self.adapter(root)
            n = self.native
            complete = None
            pending_ids = []
            for _ in range(20):
                try:
                    base_dir = adapter.execute("VA-16", None, "base1")
                    base = n.RunView(label="base1", run_id="base1", run_dir=base_dir,
                                     ok=True, delivered=adapter.delivered(base_dir))
                    with contextlib.redirect_stdout(io.StringIO()):
                        complete = n.recursion.run_mode("seq", "VA-16", 1, [base], adapter=adapter,
                            prop=h.T3Proposer(adapter), work_dir=root / "native", run_id_of=lambda x: x,
                            base_tree=n.tree.read_tree(n.surface, adapter.base_harness()),
                            propose_workers=1, rollout_workers=1)
                    break
                except h.Pending as pending:
                    request = pending.request
                    pending_ids.append(request["id"])
                    if request["kind"] == "editor":
                        out = {"tree": {"systemprompt.md": "Speak as a peer. " + request["key"]}, "notes": "fixture edit"}
                    elif request["kind"] == "reviewer":
                        out = {"passed": True, "factualClaims": [], "ownerClaims": [], "voiceIssues": [], "issues": []}
                    else:
                        out = {"decision": "POST", "finalText": "A fixture reply."}
                    file = root / "import.json"
                    h.write(file, response(request, out))
                    adapter.exchange.accept(request["id"], file)
            self.assertIsNotNone(complete, pending_ids)
            self.assertTrue(complete.ok, complete.errors)
            self.assertEqual(complete.ledger.R, 4)
            self.assertEqual(complete.ledger.P, 3)
            self.assertEqual(len(pending_ids), len(set(pending_ids)))
            self.assertEqual(len(pending_ids), 11)
            rendered = h.clean(complete.to_dict())
            self.assertIsNone(rendered["ledger"]["usd"])
            self.assertTrue((root / "native/harnesses/c1/systemprompt.md").exists())


if __name__ == "__main__":
    unittest.main()
